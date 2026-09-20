import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { emailOTP, phoneNumber } from "better-auth/plugins";
import {
  allowedEmail,
  reserveOtp,
  deliverEmailOtp,
  deliverWhatsappOtp,
} from "./otp-delivery";
import { db } from "./db";
import * as schema from "@/db/schema";
import { normalizeEmail } from "./permissions";
import { z } from "zod";
import { consoleTwoStep } from "./security-plugin";
export const auth = betterAuth({
  appName: "Anuntech Console",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/phone-number/send-otp": { window: 60, max: 3 },
      "/phone-number/verify": { window: 60, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path;
      const invalid = () =>
        new APIError("BAD_REQUEST", {
          message: "Não foi possível concluir. Confira os dados e o código.",
        });
      if (
        (path.startsWith("/email-otp/") &&
          path !== "/email-otp/send-verification-otp") ||
        (path.startsWith("/phone-number/") &&
          !["/phone-number/send-otp", "/phone-number/verify"].includes(path)) ||
        [
          "/sign-in/phone-number",
          "/sign-in/email",
          "/sign-up/email",
          "/set-password",
          "/change-password",
          "/reset-password",
          "/request-password-reset",
          "/change-email",
        ].includes(path)
      )
        throw invalid();
      if (
        path === "/email-otp/send-verification-otp" ||
        path === "/sign-in/email-otp"
      ) {
        const email = String(ctx.body?.email || "")
          .trim()
          .toLowerCase();
        if (!z.email().max(254).safeParse(email).success) throw invalid();
        ctx.body.email = email;
        if (path === "/email-otp/send-verification-otp") {
          if (ctx.body.type !== "sign-in") throw invalid();
          if (!(await reserveOtp(email)))
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Aguarde antes de solicitar outro código.",
            });
          if (!(await allowedEmail(email))) return ctx.json({ success: true });
        } else if (!(await allowedEmail(email))) throw invalid();
      }
      if (
        path === "/phone-number/send-otp" ||
        path === "/phone-number/verify"
      ) {
        const phone = String(ctx.body?.phoneNumber || "");
        if (!/^\+[1-9]\d{9,14}$/.test(phone)) throw invalid();
        const binding =
          path === "/phone-number/verify"
            ? ctx.body.updatePhoneNumber === true
            : ctx.headers?.get("x-console-purpose") === "bind";
        if (binding) {
          const session = await getSessionFromCtx(ctx);
          if (
            !session?.user.emailVerified ||
            session.user.twoFactorEnabled ||
            !(await allowedEmail(session.user.email)) ||
            Date.now() - new Date(session.session.createdAt).getTime() > 600000
          )
            throw new APIError("UNAUTHORIZED", {
              message: "Entre novamente para vincular seu WhatsApp.",
            });
        } else {
          const [user] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.phoneNumber, phone));
          const allowed =
            user?.phoneNumberVerified &&
            user.emailVerified &&
            (await allowedEmail(user.email));
          if (!allowed) {
            if (path === "/phone-number/send-otp") {
              if (!(await reserveOtp(phone)))
                throw new APIError("TOO_MANY_REQUESTS", {
                  message: "Aguarde antes de solicitar outro código.",
                });
              return ctx.json({ message: "code sent" });
            }
            throw invalid();
          }
        }
        if (path === "/phone-number/send-otp" && !(await reserveOtp(phone)))
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Aguarde antes de solicitar outro código.",
          });
      }
      if (path === "/update-user") {
        const session = await getSessionFromCtx(ctx);
        if (
          !session?.user.emailVerified ||
          !(await allowedEmail(session.user.email)) ||
          Date.now() - new Date(session.session.createdAt).getTime() > 600000
        )
          throw new APIError("UNAUTHORIZED", {
            message: "Entre novamente para alterar seu WhatsApp.",
          });
        if (
          session.user.twoFactorEnabled ||
          ctx.body?.phoneNumber !== null ||
          Object.keys(ctx.body || {}).some((key) => key !== "phoneNumber")
        )
          throw new APIError("FORBIDDEN", {
            message:
              "Use as configurações da conta. Desative a verificação em duas etapas antes de alterar seus contatos.",
          });
      }
    }),
  },
  advanced: { cookiePrefix: "anuntech-console" },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = normalizeEmail(newUser.email);
          if (!(await allowedEmail(email)))
            throw new APIError("FORBIDDEN", {
              message: "Acesso disponível somente para usuários autorizados.",
            });
          return { data: { ...newUser, email } };
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in" && (await allowedEmail(email)))
          await deliverEmailOtp(email, otp);
      },
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      requireVerification: true,
      phoneNumberValidator: (phone) => /^\+[1-9]\d{9,14}$/.test(phone),
      sendOTP: async ({ phoneNumber, code }) => {
        await deliverWhatsappOtp(phoneNumber, code);
      },
    }),
    consoleTwoStep(),
    nextCookies(),
  ],
});
