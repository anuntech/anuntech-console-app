import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "../db";
import {
  accountEmails,
  billingNotices,
  companies,
  consoleStaffMembers,
  invoices,
  memberships,
  pushDevices,
  pushNotices,
  user,
} from "@/db/schema";
import { membershipSeesEngagement } from "../access/grants";
import { billingSendTime, saoPauloDate } from "../dates";
import { reminderKindFor } from "../billing/billing-notice-rules";
import { PUSH_EVENTS, pickPushRecipients, pushPayload, type PushEvent } from "./push-rules";
import { processPushNotices } from "./push-sender";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PushInput = {
  event: PushEvent;
  /** Unique per event: the audit event id, or a fixed key for something that happens once. */
  eventKey: string;
  companyId: string;
  entityId: string;
  /** Tickets: the scope a Membro needs. Tasks: the project the tap opens. */
  engagementId?: string | null;
  /** Tickets: the opener always sees their own ticket. */
  authorId?: string;
  /** Never pushed to the person who acted. */
  actorId?: string | null;
  /** Billing pushes wait for the morning like the billing notices, and for notBefore when later. */
  morning?: boolean;
  notBefore?: Date;
};

/**
 * Queues one push per person and phone, in the transaction of the change, so
 * the push exists only if the change commits. No external I/O here; call
 * schedulePushNotices() after the commit.
 */
export async function enqueuePush(tx: Tx, input: PushInput) {
  const spec = PUSH_EVENTS[input.event];
  const [company] = await tx
    .select({ archived: companies.archived })
    .from(companies)
    .where(eq(companies.id, input.companyId));
  if (!company || company.archived) return 0;
  // memberships → verified aliases → person → enabled phones, as companyAdministrators reads them.
  const sees =
    spec.audience === "ticket" && input.engagementId
      ? sql<boolean>`(${user.id} = ${input.authorId ?? ""} or ${membershipSeesEngagement(input.engagementId)})`
      : sql<boolean>`true`;
  const rows = await tx
    .selectDistinct({ userId: user.id, email: user.email, deviceId: pushDevices.id, sees })
    .from(memberships)
    .leftJoin(accountEmails, and(eq(accountEmails.email, memberships.email), isNotNull(accountEmails.verifiedAt)))
    .innerJoin(user, or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)))
    .innerJoin(pushDevices, and(eq(pushDevices.userId, user.id), isNull(pushDevices.disabledAt)))
    .where(
      and(
        eq(memberships.companyId, input.companyId),
        eq(memberships.active, true),
        spec.audience === "managers" ? eq(memberships.role, "manager") : undefined,
      ),
    );
  if (!rows.length) return 0;
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const aliases = await tx
    .select({ userId: accountEmails.userId, email: accountEmails.email })
    .from(accountEmails)
    .where(and(inArray(accountEmails.userId, userIds), isNotNull(accountEmails.verifiedAt)));
  const staff = await tx
    .select({ email: consoleStaffMembers.email })
    .from(consoleStaffMembers)
    .where(eq(consoleStaffMembers.active, true));
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
  const staffEmails = new Set([...staff.map((s) => s.email.toLowerCase()), ...(owner ? [owner] : [])]);
  const recipients = pickPushRecipients(
    rows.map((r) => ({
      userId: r.userId,
      deviceId: r.deviceId,
      emails: [r.email, ...aliases.filter((a) => a.userId === r.userId).map((a) => a.email)],
      sees: !!r.sees,
    })),
    { actorId: input.actorId, staffEmails },
  );
  if (!recipients.length) return 0;
  const morning = input.morning ? billingSendTime() : new Date();
  const nextAttemptAt = input.notBefore && input.notBefore > morning ? input.notBefore : morning;
  const payload = pushPayload(input.event, { id: input.entityId, engagementId: input.engagementId });
  const inserted = await tx
    .insert(pushNotices)
    .values(
      recipients.map((r) => ({
        id: randomUUID(),
        eventKey: input.eventKey,
        companyId: input.companyId,
        userId: r.userId,
        deviceId: r.deviceId,
        topic: spec.topic,
        entityType: spec.entityType,
        entityId: input.entityId,
        audience: spec.audience,
        payload,
        nextAttemptAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: pushNotices.id });
  return inserted.length;
}

/** Sends what was just queued once the response is out; the cron picks up the rest. */
export function schedulePushNotices() {
  try {
    after(async () => {
      try {
        await processPushNotices();
      } catch {
        console.error("Não foi possível enviar os pushes; a fila será retomada.");
      }
    });
  } catch {
    // Outside a request (a script): the cron sends it.
  }
}

/**
 * "Fatura em atraso", once per invoice, five days after the due date (the
 * first overdue reminder). Only invoices whose client notices are on (a
 * "Nova fatura" notice exists, as for the e-mail and WhatsApp reminders);
 * the fixed event key makes a second run a no-op. Runs from the
 * recurring-billing cron; the push waits for the morning.
 */
export async function queueOverduePushes(today = saoPauloDate()) {
  const rows = await db
    .selectDistinct({
      id: invoices.id,
      companyId: invoices.companyId,
      dueDate: invoices.dueDate,
      bankDueDate: invoices.bankDueDate,
    })
    .from(invoices)
    .innerJoin(billingNotices, and(eq(billingNotices.invoiceId, invoices.id), eq(billingNotices.kind, "initial")))
    .where(
      and(
        eq(invoices.status, "issued"),
        eq(invoices.publicEnabled, true),
        lte(invoices.dueDate, today),
        sql`${invoices.dueDate} > ${today}::date - interval '10 days'`,
      ),
    );
  let queued = 0;
  for (const row of rows) {
    if (reminderKindFor(row, today) !== "overdue_5") continue;
    queued += await db.transaction((tx) =>
      enqueuePush(tx, {
        event: "invoice.overdue",
        eventKey: `invoice.overdue:${row.id}:overdue_5`,
        companyId: row.companyId,
        entityId: row.id,
        morning: true,
      }),
    );
  }
  return { overduePushes: queued };
}

/**
 * A delivery entered Revisão (only the team puts it there): the company's
 * Administradores, who approve it, hear of it. Each entry is its own event.
 */
export function enqueueReviewPush(
  tx: Tx,
  task: { id: string; companyId: string; engagementId: string },
  actorId: string,
) {
  return enqueuePush(tx, {
    event: "task.review",
    eventKey: `task.review:${task.id}:${randomUUID()}`,
    companyId: task.companyId,
    entityId: task.id,
    engagementId: task.engagementId,
    actorId,
  });
}
