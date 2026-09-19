import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "./db";
import * as schema from "@/db/schema";
import { normalizeEmail } from "./permissions";
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
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  advanced: { cookiePrefix: "anuntech-console" },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const email = normalizeEmail(newUser.email);
          const invited = await db
            .select({ id: schema.memberships.id })
            .from(schema.memberships)
            .where(
              and(
                eq(schema.memberships.email, email),
                eq(schema.memberships.active, true),
              ),
            )
            .limit(1);
          const admin = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
          if (!admin || (email !== admin && invited.length === 0))
            throw new APIError("FORBIDDEN", {
              message: "Acesso disponível somente para usuários autorizados.",
            });
          return { data: { ...newUser, email } };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
