import "server-only";
import {
  createHash,
  randomInt,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import {
  deleteSessionCookie,
  expireCookie,
  setSessionCookie,
} from "better-auth/cookies";
import { twoFactor } from "better-auth/plugins";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { sessionAudit } from "./session-history";
import { getOAuthEmail } from "./oauth-identity";
import {
  user,
  session,
  twoFactor as twoFactorTable,
  verification,
  auditEvents,
} from "@/db/schema";
import {
  allowedEmail,
  deliverEmailOtp,
  deliverWhatsappOtp,
  reserveOtp,
} from "./otp-delivery";
import {
  isPrimarySignIn,
  maskDestination,
  secondaryChannel,
  type SecurityChannel,
} from "./security-policy";

type Context = GenericEndpointContext;
type SecurityUser = typeof user.$inferSelect;
type Binding = {
  userId: string;
  email: string;
  phone: string;
  channel: SecurityChannel;
};
type Change = Binding & {
  sessionId: string;
  action: "enable" | "disable" | "channel";
  enabled: boolean;
  previousChannel: SecurityChannel;
  stage: SecurityChannel;
};
const codeSchema = z.string().regex(/^\d{6}$/);
const changeIdSchema = z.string().regex(/^security-change-[a-f0-9]{48}$/);
const bad = () =>
  new APIError("BAD_REQUEST", {
    message: "Código inválido ou expirado. Solicite um novo código.",
  });
const denied = () =>
  new APIError("UNAUTHORIZED", {
    message: "Entre novamente para continuar a verificação.",
  });
const digest = (code: string) =>
  createHash("sha256").update(code).digest("base64url");
const id = (prefix: string) => `${prefix}${randomBytes(24).toString("hex")}`;
const channelSchema = z.enum(["email", "whatsapp"]);
const contactsMatch = (binding: Binding, current: SecurityUser) =>
  binding.userId === current.id &&
  binding.email === current.email &&
  binding.phone === current.phoneNumber &&
  current.emailVerified &&
  current.phoneNumberVerified;
function destination(binding: Binding, channel = binding.channel) {
  return channel === "email" ? binding.email : binding.phone;
}
async function deliver(
  channel: SecurityChannel,
  recipient: string,
  code: string,
) {
  try {
    if (channel === "email") await deliverEmailOtp(recipient, code);
    else await deliverWhatsappOtp(recipient, code);
  } catch {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message:
        "Não foi possível entregar o código. Aguarde um minuto e tente reenviar.",
    });
  }
}
async function authorizedUser(userId: string) {
  const [current] = await db.select().from(user).where(eq(user.id, userId));
  if (
    !current?.emailVerified ||
    !current.phoneNumberVerified ||
    !current.phoneNumber ||
    !(await allowedEmail(current.email))
  )
    throw denied();
  return current;
}
async function fullSession(ctx: Context) {
  const current = await getSessionFromCtx(ctx);
  if (!current) throw denied();
  return { current, account: await authorizedUser(current.user.id) };
}
async function pending(ctx: Context) {
  // A full session is never a substitute for the pending challenge.
  if (await getSessionFromCtx(ctx)) throw denied();
  const cookie = ctx.context.createAuthCookie("two_factor");
  const key = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!key) throw denied();
  const challenge =
    await ctx.context.internalAdapter.findVerificationValue(key);
  const bound = await ctx.context.internalAdapter.findVerificationValue(
    `console-two-step:${key}`,
  );
  if (
    !challenge ||
    !bound ||
    challenge.expiresAt <= new Date() ||
    bound.expiresAt <= new Date()
  )
    throw denied();
  const binding = JSON.parse(bound.value) as Binding;
  const account = await authorizedUser(challenge.value);
  if (!account.twoFactorEnabled || !contactsMatch(binding, account))
    throw denied();
  return { key, binding, account, cookie };
}
async function sendCode(
  ctx: Context,
  identifier: string,
  channel: SecurityChannel,
  recipient: string,
) {
  if (!(await reserveOtp(recipient)))
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Aguarde um minuto antes de solicitar outro código.",
    });
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
  await ctx.context.internalAdapter.createVerificationValue({
    identifier,
    value: `${digest(code)}:0`,
    expiresAt: new Date(Date.now() + 300_000),
  });
  try {
    await deliver(channel, recipient, code);
  } catch (error) {
    await ctx.context.internalAdapter.deleteVerificationByIdentifier(
      identifier,
    );
    throw error;
  }
}
async function getChange(ctx: Context, changeId: string) {
  const { current, account } = await fullSession(ctx);
  const record =
    await ctx.context.internalAdapter.findVerificationValue(changeId);
  if (!record || record.expiresAt <= new Date()) throw bad();
  const change = JSON.parse(record.value) as Change;
  if (
    change.sessionId !== current.session.id ||
    !contactsMatch(change, account) ||
    change.enabled !== account.twoFactorEnabled ||
    change.previousChannel !== account.twoStepChannel
  )
    throw denied();
  return { change, current, account };
}

export function consoleTwoStep() {
  const native = twoFactor({
    allowPasswordless: true,
    totpOptions: { disable: true },
    otpOptions: {
      storeOTP: "hashed",
      period: 5,
      allowedAttempts: 3,
      sendOTP: async () => {
        throw new Error("Use the Console OTP sender");
      },
    },
  });
  return {
    ...native,
    schema: {
      ...native.schema,
      user: {
        ...native.schema.user,
        fields: {
          ...native.schema.user.fields,
          twoStepChannel: {
            type: "string" as const,
            required: false,
            defaultValue: "whatsapp",
            input: false,
          },
        },
      },
    },
    endpoints: {
      ...native.endpoints,
      sendTwoFactorOTP: createAuthEndpoint(
        "/two-factor/send-otp",
        {
          method: "POST",
          body: z
            .object({ trustDevice: z.literal(false).optional() })
            .optional(),
        },
        async (ctx) => {
          const { key, binding } = await pending(ctx);
          await sendCode(
            ctx,
            `2fa-otp-${key}`,
            binding.channel,
            destination(binding),
          );
          return ctx.json({ status: true });
        },
      ),
      verifyTwoFactorOTP: createAuthEndpoint(
        "/two-factor/verify-otp",
        {
          method: "POST",
          body: z.object({
            code: codeSchema,
            trustDevice: z.literal(false).optional(),
          }),
        },
        async (ctx) => {
          const { key, binding, account, cookie } = await pending(ctx);
          const dontRemember = !!(await ctx.getSignedCookie(
            ctx.context.authCookies.dontRememberToken.name,
            ctx.context.secret,
          ));
          const result = await db.transaction(async (tx) => {
            const [fresh] = await tx
              .select()
              .from(user)
              .where(eq(user.id, account.id))
              .for("update");
            const [bound] = await tx
              .select()
              .from(verification)
              .where(eq(verification.identifier, `console-two-step:${key}`))
              .for("update");
            const [challenge] = await tx
              .select()
              .from(verification)
              .where(eq(verification.identifier, key))
              .for("update");
            if (
              !fresh?.twoFactorEnabled ||
              !bound ||
              !challenge ||
              bound.expiresAt <= new Date() ||
              challenge.expiresAt <= new Date() ||
              challenge.value !== fresh.id ||
              !contactsMatch(binding, fresh) ||
              JSON.stringify(binding) !== bound.value
            )
              return { error: true } as const;
            const [factor] = await tx
              .select()
              .from(twoFactorTable)
              .where(eq(twoFactorTable.userId, fresh.id));
            if (!factor) return { error: true } as const;
            if (factor.lockedUntil && factor.lockedUntil > new Date())
              return { locked: true } as const;
            const failures = factor.lockedUntil
              ? 0
              : factor.failedVerificationCount;
            const [otp] = await tx
              .delete(verification)
              .where(eq(verification.identifier, `2fa-otp-${key}`))
              .returning();
            if (!otp || otp.expiresAt <= new Date())
              return { error: true } as const;
            const [hash, count] = otp.value.split(":");
            const attempts = Number(count),
              input = digest(ctx.body.code);
            if (!Number.isInteger(attempts) || attempts >= 3)
              return { error: true } as const;
            if (
              hash.length !== input.length ||
              !timingSafeEqual(Buffer.from(hash), Buffer.from(input))
            ) {
              await tx
                .insert(verification)
                .values({ ...otp, value: `${hash}:${attempts + 1}` });
              await tx
                .update(twoFactorTable)
                .set({
                  failedVerificationCount: failures + 1,
                  lockedUntil:
                    failures + 1 >= 10 ? new Date(Date.now() + 900_000) : null,
                })
                .where(eq(twoFactorTable.id, factor.id));
              return { error: true } as const;
            }
            await tx
              .delete(verification)
              .where(eq(verification.id, challenge.id));
            await tx.delete(verification).where(eq(verification.id, bound.id));
            await tx
              .delete(verification)
              .where(eq(verification.identifier, `2fa-attempts-${key}`));
            await tx
              .update(twoFactorTable)
              .set({ failedVerificationCount: 0, lockedUntil: null })
              .where(eq(twoFactorTable.id, factor.id));
            // This database-backed Console has no session adapter hooks or cache.
            // Insert under the same user lock as contact/security edits so a
            // revoked challenge cannot race those edits and mint a new session.
            const [created] = await tx
              .insert(session)
              .values({
                id: randomUUID(),
                token: randomBytes(32).toString("base64url"),
                userId: fresh.id,
                expiresAt: new Date(
                  Date.now() +
                    (dontRemember
                      ? 86400
                      : (ctx.context.options.session?.expiresIn ?? 604800)) *
                      1000,
                ),
                userAgent: ctx.headers?.get("user-agent") || null,
              })
              .returning();
            await tx.insert(auditEvents).values(sessionAudit(created)).onConflictDoNothing();
            return { session: created, user: fresh } as const;
          });
          if ("locked" in result)
            throw new APIError("TOO_MANY_REQUESTS", {
              message:
                "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
            });
          if ("error" in result) throw bad();
          await setSessionCookie(
            ctx,
            { session: result.session, user: result.user },
            dontRemember,
          );
          expireCookie(ctx, cookie);
          return ctx.json({ token: result.session.token, user: result.user });
        },
      ),
      securityChallenge: createAuthEndpoint(
        "/security/challenge",
        { method: "GET" },
        async (ctx) => {
          const { binding } = await pending(ctx);
          ctx.setHeader("Cache-Control", "no-store");
          return ctx.json({
            channel: binding.channel,
            destination: maskDestination(binding.channel, destination(binding)),
          });
        },
      ),
      cancelSecurityChallenge: createAuthEndpoint(
        "/security/cancel",
        { method: "POST" },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie("two_factor");
          const key = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          );
          if (key)
            for (const identifier of [
              key,
              `2fa-attempts-${key}`,
              `2fa-otp-${key}`,
              `console-two-step:${key}`,
            ])
              await ctx.context.internalAdapter.deleteVerificationByIdentifier(
                identifier,
              );
          expireCookie(ctx, cookie);
          return ctx.json({ status: true });
        },
      ),
      startSecurityChange: createAuthEndpoint(
        "/security/start-change",
        {
          method: "POST",
          body: z.object({
            action: z.enum(["enable", "disable", "channel"]),
            channel: channelSchema,
          }),
        },
        async (ctx) => {
          const { current, account } = await fullSession(ctx);
          if (
            (ctx.body.action === "enable") === account.twoFactorEnabled ||
            (ctx.body.action === "channel" && !account.twoFactorEnabled)
          )
            throw bad();
          const changeId = id("security-change-");
          const change: Change = {
            userId: account.id,
            email: account.email,
            phone: account.phoneNumber!,
            channel: ctx.body.channel,
            sessionId: current.session.id,
            enabled: account.twoFactorEnabled,
            previousChannel: account.twoStepChannel,
            action: ctx.body.action,
            stage: "email",
          };
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: changeId,
            value: JSON.stringify(change),
            expiresAt: new Date(Date.now() + 600_000),
          });
          return ctx.json({
            changeId,
            stage: change.stage,
            destination: maskDestination("email", account.email),
          });
        },
      ),
      sendSecurityChange: createAuthEndpoint(
        "/security/send-change",
        { method: "POST", body: z.object({ changeId: changeIdSchema }) },
        async (ctx) => {
          const { change } = await getChange(ctx, ctx.body.changeId);
          await sendCode(
            ctx,
            `${ctx.body.changeId}:${change.stage}`,
            change.stage,
            destination(change, change.stage),
          );
          return ctx.json({ status: true });
        },
      ),
      verifySecurityChange: createAuthEndpoint(
        "/security/verify-change",
        {
          method: "POST",
          body: z.object({ changeId: changeIdSchema, code: codeSchema }),
        },
        async (ctx) => {
          const { current } = await getChange(ctx, ctx.body.changeId);
          // Lock the account first, as contact edits do, then the proof. Concurrent
          // verifies, profile changes and expired/revoked sessions cannot reuse it.
          const result = await db.transaction(async (tx) => {
            const [account] = await tx
              .select()
              .from(user)
              .where(eq(user.id, current.user.id))
              .for("update");
            const [live] = await tx
              .select()
              .from(session)
              .where(
                and(
                  eq(session.id, current.session.id),
                  gt(session.expiresAt, new Date()),
                ),
              );
            const [record] = await tx
              .select()
              .from(verification)
              .where(eq(verification.identifier, ctx.body.changeId))
              .for("update");
            if (!account || !live || !record || record.expiresAt <= new Date())
              return { error: true } as const;
            const change = JSON.parse(record.value) as Change;
            if (
              change.sessionId !== live.id ||
              !contactsMatch(change, account) ||
              account.twoFactorEnabled !== change.enabled ||
              account.twoStepChannel !== change.previousChannel
            )
              return { error: true } as const;
            const [otp] = await tx
              .delete(verification)
              .where(
                eq(
                  verification.identifier,
                  `${ctx.body.changeId}:${change.stage}`,
                ),
              )
              .returning();
            if (!otp || otp.expiresAt <= new Date())
              return { error: true } as const;
            const [hash, count] = otp.value.split(":");
            const attempts = Number(count);
            if (attempts >= 3 || !Number.isInteger(attempts))
              return { error: true } as const;
            const input = digest(ctx.body.code);
            if (
              hash.length !== input.length ||
              !timingSafeEqual(Buffer.from(hash), Buffer.from(input))
            ) {
              await tx
                .insert(verification)
                .values({ ...otp, value: `${hash}:${attempts + 1}` });
              return { error: true } as const;
            }
            if (change.stage === "email") {
              await tx
                .update(verification)
                .set({
                  value: JSON.stringify({ ...change, stage: "whatsapp" }),
                })
                .where(eq(verification.id, record.id));
              return {
                stage: "whatsapp",
                destination: maskDestination("whatsapp", change.phone),
              } as const;
            }
            await tx.delete(verification).where(eq(verification.id, record.id));
            await tx
              .update(user)
              .set({
                twoFactorEnabled: change.action !== "disable",
                twoStepChannel: change.channel,
                updatedAt: new Date(),
              })
              .where(eq(user.id, account.id));
            await tx
              .insert(twoFactorTable)
              .values({
                id: randomUUID(),
                userId: account.id,
                secret: "",
                backupCodes: "",
                verified: false,
              })
              .onConflictDoUpdate({
                target: twoFactorTable.userId,
                set: { failedVerificationCount: 0, lockedUntil: null },
              });
            // Preserve the current, freshly proven session; revoke every other one.
            await tx
              .delete(session)
              .where(
                and(
                  eq(session.userId, account.id),
                  sql`${session.id} <> ${live.id}`,
                ),
              );
            await tx
              .update(session)
              .set({ createdAt: new Date(), updatedAt: new Date() })
              .where(eq(session.id, live.id));
            // Invalidate pending sign-ins started before this security change.
            const challenges = await tx
              .select()
              .from(verification)
              .where(sql`${verification.identifier} like 'console-two-step:%'`);
            for (const challenge of challenges) {
              if (
                (JSON.parse(challenge.value) as Binding).userId !== account.id
              )
                continue;
              const key = challenge.identifier.replace("console-two-step:", "");
              for (const identifier of [
                challenge.identifier,
                key,
                `2fa-otp-${key}`,
                `2fa-attempts-${key}`,
              ])
                await tx
                  .delete(verification)
                  .where(eq(verification.identifier, identifier));
            }
            await tx.insert(auditEvents).values({
              actorId: account.id,
              entityId: account.id,
              action:
                change.action === "enable"
                  ? "account.security.enabled"
                  : change.action === "disable"
                    ? "account.security.disabled"
                    : "account.security.channel_changed",
              details: { channel: change.channel },
            });
            return { complete: true } as const;
          });
          if ("error" in result) throw bad();
          return ctx.json(result);
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) =>
            ctx.path?.startsWith("/two-factor/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (
              !["/two-factor/send-otp", "/two-factor/verify-otp"].includes(
                ctx.path,
              ) ||
              ctx.body?.trustDevice
            )
              throw new APIError("FORBIDDEN", {
                message: "Use as configurações de segurança da sua conta.",
              });
          }),
        },
      ],
      after: [
        {
          matcher: (ctx: { path?: string }) => isPrimarySignIn(ctx.path || ""),
          handler: createAuthMiddleware(async (ctx) => {
            const fresh = ctx.context.newSession;
            if (!fresh) return;
            let account: SecurityUser | undefined;
            try {
              [account] = await db
                .select()
                .from(user)
                .where(eq(user.id, fresh.user.id));
            } catch {
              // Fail closed if the policy lookup fails after the primary login
              // has created a token. Never return that token or its cookie.
              deleteSessionCookie(ctx, true);
              ctx.context.setNewSession(null);
              await ctx.context.internalAdapter
                .deleteSession(fresh.session.token)
                .catch(() => undefined);
              throw new APIError("SERVICE_UNAVAILABLE", {
                message:
                  "Não foi possível confirmar a segurança da conta. Entre novamente.",
              });
            }
            const oauth =
              ctx.path === "/sign-in/social" ||
              ctx.path.startsWith("/callback/");
            const oauthEmail = getOAuthEmail(ctx.context);
            if (
              !account ||
              fresh.user.email !== account.email ||
              (oauth && (!oauthEmail || oauthEmail !== account.email))
            ) {
              // A principal-email change revokes older sessions. Recheck the
              // identity proven by this request so an in-flight old login
              // cannot issue a fresh session after that revocation commits.
              deleteSessionCookie(ctx, true);
              ctx.context.setNewSession(null);
              await ctx.context.internalAdapter.deleteSession(
                fresh.session.token,
              );
              if (ctx.path.startsWith("/callback/"))
                throw ctx.redirect(
                  `${ctx.context.baseURL.split("/api/auth")[0]}/entrar?erro=acesso`,
                );
              throw new APIError("UNAUTHORIZED", {
                message: "Entre novamente usando seu e-mail principal atual.",
              });
            }
            if (!account.twoFactorEnabled) {
              await db.insert(auditEvents).values(sessionAudit(fresh.session)).onConflictDoNothing()
                .catch(() => console.error("Session history could not be recorded"));
              return;
            }
            // The primary token must never leave the server while a challenge exists.
            deleteSessionCookie(ctx, true);
            ctx.context.setNewSession(null);
            await ctx.context.internalAdapter.deleteSession(
              fresh.session.token,
            );
            const verified = await authorizedUser(account.id);
            const binding: Binding = {
              userId: verified.id,
              email: verified.email,
              phone: verified.phoneNumber!,
              channel: secondaryChannel(ctx.path, verified.twoStepChannel),
            };
            const key = id("2fa-");
            const expiresAt = new Date(Date.now() + 600_000);
            for (const [identifier, value] of [
              [key, account.id],
              [`2fa-attempts-${key}`, "0"],
              [`console-two-step:${key}`, JSON.stringify(binding)],
            ])
              await ctx.context.internalAdapter.createVerificationValue({
                identifier,
                value,
                expiresAt,
              });
            const cookie = ctx.context.createAuthCookie("two_factor", {
              maxAge: 600,
            });
            await ctx.setSignedCookie(
              cookie.name,
              key,
              ctx.context.secret,
              cookie.attributes,
            );
            if (ctx.path.startsWith("/callback/"))
              throw ctx.redirect(
                `${ctx.context.baseURL.split("/api/auth")[0]}/verificar-acesso`,
              );
            return ctx.json({
              twoFactorRedirect: true,
              twoFactorMethods: ["otp"],
            });
          }),
        },
      ],
    },
  };
}
