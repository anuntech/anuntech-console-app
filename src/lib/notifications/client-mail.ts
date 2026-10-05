import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { accountEmails, memberships, user } from "@/db/schema";
import { db } from "../db";

/** One e-mail to a client contact through Resend; throws when it was not accepted. */
export async function sendClientMail(input: { to: string; subject: string; text: string; tag: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${input.tag}-${randomUUID()}`,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.id) throw new Error("Não foi possível enviar o e-mail.");
}

/** The company's Administradores, who answer for it (quotes, contracts, hours). */
export async function companyAdministrators(companyId: string) {
  return db
    .select({ email: memberships.email, name: user.name })
    .from(memberships)
    .leftJoin(accountEmails, and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)))
    .leftJoin(user, or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true), eq(memberships.role, "manager")));
}
