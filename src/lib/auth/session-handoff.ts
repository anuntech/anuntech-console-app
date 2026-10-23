import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { and, count, eq, gt, like, lt } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, session, user, verification } from "@/db/schema";
import { db } from "../db";
import { safeHandoffPath } from "./handoff-path";
import { allowedEmail } from "./otp-delivery";
import { sessionAudit } from "./session-history";

/**
 * The app's bridge to the web Console: what the app cannot do (drawing a
 * board, a page it does not have) opens in its browser already signed in.
 *
 * The app, with a full session (the second step, when on, was done to get
 * it), asks for a hand-off (account.openWeb). The Console keeps only the
 * SHA-256 of a random token in console_verification, bound to the person, the
 * app session and the page, for two minutes. The browser opens
 * /api/auth/app-handoff?t=…; the first visit deletes the record (single use),
 * checks the person and the app session are still valid and starts a normal
 * web session, recorded like any sign-in plus an account.session.handoff
 * audit. Any failure lands on /entrar, as an expired link would; a browser
 * where someone else is signed in keeps that session and goes to /painel.
 */
export const HANDOFF_TTL_SECONDS = 120;
/** The web session a hand-off starts lasts a day, like a sign-in without "remember me". */
const WEB_SESSION_SECONDS = 86400;
/** Live hand-offs a person may hold at once; more is someone hammering the button. */
const HANDOFF_LIVE_MAX = 10;
const PREFIX = "app-handoff:";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

type Binding = { userId: string; sessionId: string; next: string };

const digest = (token: string) => createHash("sha256").update(token).digest("base64url");

/** The hand-off is refused (bad page, too many at once). */
export class HandoffError extends Error {}

/** A fresh hand-off for the app session, to `next` on the web: the path the app opens. */
export async function issueSessionHandoff(from: { userId: string; sessionId: string }, next: unknown) {
  const page = safeHandoffPath(next);
  if (!page) throw new HandoffError("Esse endereço não abre no Console.");
  const now = new Date();
  await db.delete(verification).where(and(like(verification.identifier, `${PREFIX}%`), lt(verification.expiresAt, now)));
  // The binding starts with the user id, so the live ones of a person are a prefix match.
  const value = JSON.stringify({ userId: from.userId, sessionId: from.sessionId, next: page } satisfies Binding);
  const [live] = await db
    .select({ n: count() })
    .from(verification)
    .where(
      and(
        like(verification.identifier, `${PREFIX}%`),
        like(verification.value, `${JSON.stringify({ userId: from.userId }).slice(0, -1)},%`),
        gt(verification.expiresAt, now),
      ),
    );
  if ((live?.n ?? 0) >= HANDOFF_LIVE_MAX)
    throw new HandoffError("Aguarde um minuto antes de abrir o Console de novo.");
  const token = randomBytes(32).toString("base64url");
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: `${PREFIX}${digest(token)}`,
    value,
    expiresAt: new Date(now.getTime() + HANDOFF_TTL_SECONDS * 1000),
  });
  return { path: `/api/auth/app-handoff?t=${token}`, expiresAt: new Date(now.getTime() + HANDOFF_TTL_SECONDS * 1000).toISOString() };
}

/** As Better Auth reads it for its own sessions: Vercel sends the client's address alone in x-forwarded-for. */
function clientIp(headers: Headers | undefined) {
  const hops = (headers?.get("x-forwarded-for") ?? "").split(",").map((ip) => ip.trim()).filter(Boolean);
  return hops.length === 1 ? hops[0].slice(0, 64) : null;
}

/** The Better Auth plugin with the endpoint the app's browser opens. */
export function consoleHandoff() {
  return {
    id: "console-app-handoff",
    endpoints: {
      appHandoff: createAuthEndpoint(
        "/app-handoff",
        { method: "GET", query: z.object({ t: z.string().max(100).optional() }) },
        async (ctx) => {
          const origin = ctx.context.baseURL.split("/api/auth")[0];
          ctx.setHeader("Cache-Control", "no-store");
          ctx.setHeader("Referrer-Policy", "no-referrer");
          const refuse = () => ctx.redirect(`${origin}/entrar`);
          const token = ctx.query?.t ?? "";
          if (!TOKEN.test(token)) throw refuse();
          // Deleting first makes it single use, even with two tabs racing.
          const [record] = await db
            .delete(verification)
            .where(eq(verification.identifier, `${PREFIX}${digest(token)}`))
            .returning();
          if (!record || record.expiresAt <= new Date()) throw refuse();
          let binding: Binding;
          try {
            binding = JSON.parse(record.value) as Binding;
          } catch {
            throw refuse();
          }
          const next = safeHandoffPath(binding.next);
          if (!next || typeof binding.userId !== "string" || typeof binding.sessionId !== "string") throw refuse();
          const target = `${origin}${next}`;

          // Already this person on the web: just go. Someone else signed in here is
          // never swapped out by a link (nobody gets signed into another's account).
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (current?.user.id === binding.userId) throw ctx.redirect(target);
          if (current) throw ctx.redirect(`${origin}/painel`);

          const [account] = await db.select().from(user).where(eq(user.id, binding.userId));
          if (!account?.emailVerified || !(await allowedEmail(account.email))) throw refuse();

          const result = await db.transaction(async (tx) => {
            // Under the same user lock as contact and security changes, so a revoked
            // app session cannot race them and still open the web.
            const [fresh] = await tx.select().from(user).where(eq(user.id, binding.userId)).for("update");
            const [source] = await tx
              .select()
              .from(session)
              .where(and(eq(session.id, binding.sessionId), eq(session.userId, binding.userId), gt(session.expiresAt, new Date())));
            if (!fresh || !source || fresh.email !== account.email) return null;
            const [created] = await tx
              .insert(session)
              .values({
                id: randomUUID(),
                token: randomBytes(32).toString("base64url"),
                userId: fresh.id,
                // A browser session, as "don't remember me": one day at most and no
                // lasting cookie, since the app's browser outlives a sign-out in the app.
                expiresAt: new Date(Date.now() + WEB_SESSION_SECONDS * 1000),
                userAgent: ctx.headers?.get("user-agent") || null,
                ipAddress: clientIp(ctx.headers),
              })
              .returning();
            await tx.insert(auditEvents).values(sessionAudit(created)).onConflictDoNothing();
            await tx.insert(auditEvents).values({
              actorId: fresh.id,
              action: "account.session.handoff",
              entityId: created.id,
              details: { from: "app", appSessionId: source.id, next: next.split(/[?#]/)[0] },
            });
            return { session: created, user: fresh };
          });
          if (!result) throw refuse();
          await setSessionCookie(ctx, result, true);
          throw ctx.redirect(target);
        },
      ),
    },
  };
}
