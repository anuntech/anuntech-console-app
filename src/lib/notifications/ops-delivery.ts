import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { automationEvents } from "@/db/schema";
import { db } from "../db";

/*
 * Whether the team's own alerts reach each person: Resend answers 200 for a
 * suppressed address too, so the delivery of each alert is read back later,
 * and the Painel and the digest say who stopped receiving them.
 */

type OpsMail = { to: string; subject: string; status: "sent" | "delivered" | "failed"; event?: string };

/** Reads back up to 10 recent staff alerts and client invites still without a final answer; called by the 5-minute cron. */
export async function checkOpsDeliveries(deadline = Date.now() + 30_000) {
  const rows = await db
    .select()
    .from(automationEvents)
    .where(
      and(
        inArray(automationEvents.kind, ["ops-mail", "invite.mail"]),
        sql`${automationEvents.details}->>'status' = 'sent'`,
        gte(automationEvents.createdAt, sql`now() - interval '3 days'`),
        sql`${automationEvents.createdAt} < now() - interval '2 minutes'`,
      ),
    )
    .orderBy(asc(automationEvents.createdAt))
    .limit(10);
  for (const row of rows) {
    if (Date.now() > deadline) break;
    try {
      const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.entityId)}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; last_event?: string } | null;
      if (!res.ok || data?.id !== row.entityId) continue;
      const event = String(data.last_event ?? "");
      const status = ["bounced", "complained", "failed", "suppressed"].includes(event)
        ? "failed"
        : ["delivered", "opened", "clicked"].includes(event)
          ? "delivered"
          : "sent";
      if (status === "sent") continue;
      await db
        .update(automationEvents)
        .set({ details: { ...(row.details as OpsMail), status, event } })
        .where(eq(automationEvents.id, row.id));
    } catch {
      /* Read again on the next run. */
    }
  }
}

/** Staff addresses whose most recent alert in two weeks did not arrive (suppressed, bounced); only people still on the team. */
export async function unreachableStaff(current: string[]) {
  const team = new Set(current);
  const rows = await db
    .select({ details: automationEvents.details, createdAt: automationEvents.createdAt })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "ops-mail"), gte(automationEvents.createdAt, sql`now() - interval '14 days'`)))
    .orderBy(desc(automationEvents.createdAt));
  const latest = new Map<string, { status: string; event?: string; at: Date }>();
  for (const row of rows) {
    const mail = row.details as OpsMail | null;
    if (!mail?.to || mail.status === "sent" || latest.has(mail.to)) continue;
    latest.set(mail.to, { status: mail.status, event: mail.event, at: row.createdAt });
  }
  return [...latest.entries()]
    .filter(([email, mail]) => mail.status === "failed" && team.has(email))
    .map(([email, mail]) => ({ email, event: mail.event ?? "failed", since: mail.at.toISOString() }));
}
