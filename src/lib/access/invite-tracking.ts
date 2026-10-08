import "server-only";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { accountEmails, automationEvents, companies, memberships, user } from "@/db/schema";
import { db } from "../db";

/*
 * Invites to a company: each e-mail is recorded with Resend's id, read back
 * by the 5-minute routine (ops-delivery.ts), and the team sees who never
 * signed in, with what happened to the e-mail. A resend is a click.
 */

/** Records an invite e-mail; never breaks the caller. */
export async function recordInvite(resendId: string, invite: { membershipId: string; companyId: string; email: string }) {
  await db
    .insert(automationEvents)
    .values({ kind: "invite.mail", entityId: resendId, companyId: invite.companyId, details: { email: invite.email, membershipId: invite.membershipId, status: "sent" } })
    .onConflictDoNothing()
    .catch(() => undefined);
}

export const inviteStatusLabel: Record<string, string> = {
  sent: "enviado",
  delivered: "entregue",
  failed: "não chegou",
};

/** Active company accesses created 3+ days ago whose person never confirmed the e-mail, with the last invite's fate. */
export async function stalledInvites() {
  const rows = await db
    .select({
      id: memberships.id,
      email: memberships.email,
      companyId: memberships.companyId,
      company: companies.name,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(
        eq(memberships.active, true),
        eq(companies.archived, false),
        lt(memberships.createdAt, sql`now() - interval '3 days'`),
        sql`not exists (select 1 from ${user} u where u.email = ${memberships.email} and u.email_verified)`,
        sql`not exists (select 1 from ${accountEmails} e where e.email = ${memberships.email} and e.verified_at is not null)`,
      ),
    )
    .orderBy(asc(memberships.createdAt));
  if (!rows.length) return [];
  const mails = await db
    .select({ details: automationEvents.details, at: automationEvents.createdAt })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "invite.mail"), inArray(automationEvents.companyId, [...new Set(rows.map((r) => r.companyId))])))
    .orderBy(desc(automationEvents.createdAt));
  return rows.map((row) => {
    const last = mails.find((m) => (m.details as { membershipId?: string } | null)?.membershipId === row.id);
    const details = last?.details as { status?: string; event?: string } | undefined;
    return { ...row, invitedAt: last?.at ?? null, status: details?.status ?? null, event: details?.event ?? null };
  });
}
