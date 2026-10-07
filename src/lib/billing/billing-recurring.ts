import "server-only";
import { and, asc, desc, eq, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, invoices, companies, auditEvents, engagements } from "@/db/schema";
import { saoPauloDate } from "../dates";
import { addDays, earlyIssueAllowed, EARLY_ISSUE_HORIZON_DAYS, issueDate } from "./recurrence";

/** A monthly period plus the days a bank may move a due date past a weekend. */
const PREVIOUS_PERIOD_DAYS = 40;
import { publishInvoice } from "./billing-publish";
import { reconcileCharge } from "./billing-sync";
import { alertRecurrencePaused } from "../notifications/ops-alerts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What decides an early issue, read inside the transaction that holds the recurrence. */
async function earlyState(tx: Tx | typeof db, sub: typeof subscriptions.$inferSelect, today: string) {
  const [[previous], [open], [engagement], [period]] = await Promise.all([
    tx
      .select({ status: invoices.status, dueDate: invoices.dueDate })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, sub.id), lt(invoices.dueDate, sub.nextDueDate)))
      .orderBy(desc(invoices.dueDate))
      .limit(1),
    tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, sub.id), eq(invoices.status, "issued")))
      .limit(1),
    sub.engagementId
      ? tx.select({ status: engagements.status }).from(engagements).where(eq(engagements.id, sub.engagementId))
      : Promise.resolve([{ status: "active" as const }]),
    // A draft left by an early try that failed: the period waits for its usual day.
    tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, sub.id), eq(invoices.dueDate, sub.nextDueDate)))
      .limit(1),
  ]);
  // Only the period right before counts: a deleted or skipped one never unlocks an early issue.
  const adjacent = !!previous && previous.dueDate >= addDays(sub.nextDueDate, -PREVIOUS_PERIOD_DAYS);
  return earlyIssueAllowed({
    interval: sub.interval,
    issueOnPayment: sub.issueOnPayment,
    nextDueDate: sub.nextDueDate,
    today,
    previousStatus: adjacent && !period ? previous.status : null,
    hasOpenInvoice: !!open,
    engagementActive: engagement?.status === "active",
  });
}

export async function processSubscriptions() {
  const today = saoPauloDate();
  // Everything whose issue date (due date minus lead days) has arrived, and
  // monthly periods whose previous invoice was just paid, oldest first, in
  // batches the run can finish; a fixed cap without an order could let a few
  // skipped rows starve the rest.
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        or(
          lte(
            sql`(${subscriptions.nextDueDate} - ${subscriptions.leadDays})`,
            today,
          ),
          and(
            eq(subscriptions.interval, "monthly"),
            eq(subscriptions.issueOnPayment, true),
            sql`${subscriptions.nextDueDate} > ${today}`,
            lte(subscriptions.nextDueDate, addDays(today, EARLY_ISSUE_HORIZON_DAYS)),
            sql`not exists (select 1 from ${invoices} where ${invoices.subscriptionId} = ${subscriptions.id} and (${invoices.status} = 'issued' or ${invoices.dueDate} = ${subscriptions.nextDueDate}))`,
            sql`(select ${invoices.status} from ${invoices} where ${invoices.subscriptionId} = ${subscriptions.id} and ${invoices.dueDate} < ${subscriptions.nextDueDate} order by ${invoices.dueDate} desc limit 1) = 'paid'`,
          ),
        ),
      ),
    )
    .orderBy(asc(subscriptions.nextDueDate))
    .limit(20);
  let issued = 0,
    failed = 0;
  // Every outcome is reported, so a silent skip shows up in the cron log.
  const skipped: { id: string; reason: string }[] = [];
  const errors: { id: string; error: string }[] = [];
  let early = 0;
  for (const sub of rows) {
    // Ahead of its issue date, a period goes out only because the previous one was paid.
    const ahead = issueDate(sub.nextDueDate, sub.leadDays) > today;
    if (ahead && !(await earlyState(db, sub, today))) {
      skipped.push({ id: sub.id, reason: "issue date ahead" });
      continue;
    }
    let createdId: string | undefined;
    try {
      const invoice = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, sub.id))
          .for("update");
        if (
          !current ||
          current.status !== "active" ||
          current.nextDueDate !== sub.nextDueDate
        )
          return null;
        if (ahead && !(await earlyState(tx, current, today))) return null;
        const [company] = await tx
          .select()
          .from(companies)
          .where(eq(companies.id, current.companyId));
        if (!company || company.archived)
          throw Error("Cliente arquivado. Pause ou revise a recorrência.");
        if (current.nextDueDate <= today)
          throw Error(
            "Vencimento ultrapassado sem emissão. Revise a recorrência antes de continuar.",
          );
        const [existing] = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.subscriptionId, current.id),
              eq(invoices.dueDate, current.nextDueDate),
            ),
          );
        if (existing) return existing;
        const [created] = await tx
          .insert(invoices)
          .values({
            companyId: current.companyId,
            engagementId: current.engagementId,
            subscriptionId: current.id,
            description: current.description,
            amountCents: current.amountCents,
            dueDate: current.nextDueDate,
            discountCents: current.discountCents,
            fineBps: current.fineBps,
            interestMonthlyBps: current.interestMonthlyBps,
          })
          .returning();
        await tx.insert(auditEvents).values({
          actorId: current.actorId,
          companyId: current.companyId,
          action: "invoice.drafted",
          entityId: created.id,
          details: { source: "recurring", subscriptionId: current.id, early: ahead },
        });
        return created;
      });
      if (!invoice) {
        skipped.push({ id: sub.id, reason: "changed or inactive meanwhile" });
        continue;
      }
      createdId = invoice.id;
      if (
        invoice.status !== "draft" ||
        invoice.bankRequest ||
        invoice.providerId
      )
        throw Error(
          "A fatura deste período já tem emissão, tentativa ou cancelamento. Confira no detalhe antes de continuar.",
        );
      const result = await publishInvoice(
        invoice.id,
        sub.actorId,
        sub.collectionDays,
        true,
        true,
        true,
      );
      if (result.error) throw Error(result.error);
      issued++;
      if (ahead) early++;
      try {
        await reconcileCharge(invoice.id, sub.actorId, undefined, "scheduled");
      } catch {
        /* Processing remains pending for the reconciliation cron. */
      }
    } catch (error) {
      failed++;
      errors.push({ id: sub.id, error: error instanceof Error ? error.message : String(error) });
      // An early try that never reached the bank does not stop the recurrence: the
      // period goes out on its usual day, and fails loudly there if it still cannot.
      if (ahead && createdId) {
        const [draft] = await db.select({ bankRequest: invoices.bankRequest }).from(invoices).where(eq(invoices.id, createdId));
        if (draft && !draft.bankRequest) {
          const usual = issueDate(sub.nextDueDate, sub.leadDays).split("-").reverse().join("/");
          await db
            .update(subscriptions)
            .set({ lastError: `A emissão logo após o pagamento não saiu: ${error instanceof Error ? error.message : "falha no Inter"} Nova tentativa em ${usual}.` })
            .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, "active")));
          continue;
        }
      }
      await db
        .update(subscriptions)
        .set({
          status: "paused",
          lastError:
            error instanceof Error
              ? error.message
              : "Falha ao emitir recorrência.",
        })
        .where(
          and(
            eq(subscriptions.id, sub.id),
            eq(subscriptions.status, "active"),
            eq(subscriptions.nextDueDate, sub.nextDueDate),
          ),
        );
      await alertRecurrencePaused(sub.id, error instanceof Error ? error.message : "Falha ao emitir recorrência.");
    }
  }
  return { today, selected: rows.map((r) => r.id), issued, early, failed, skipped, errors };
}
