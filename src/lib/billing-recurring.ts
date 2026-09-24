import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, invoices, companies, auditEvents } from "@/db/schema";
import { saoPauloDate } from "./dates";
import { issueDate } from "./recurrence";
import { publishInvoice } from "./billing-publish";
import { reconcileCharge } from "./billing-sync";
import { alertRecurrencePaused } from "./ops-alerts";

export async function processSubscriptions() {
  const today = saoPauloDate();
  // Everything whose issue date (due date minus lead days) has arrived, oldest
  // first, in batches the run can finish; a fixed cap without an order could
  // let a few skipped rows starve the rest.
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(
          sql`(${subscriptions.nextDueDate} - ${subscriptions.leadDays})`,
          today,
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
  for (const sub of rows) {
    if (issueDate(sub.nextDueDate, sub.leadDays) > today) {
      skipped.push({ id: sub.id, reason: "issue date ahead" });
      continue;
    }
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
        const [company] = await tx
          .select()
          .from(companies)
          .where(eq(companies.id, current.companyId));
        if (!company || company.archived)
          throw Error("Cliente arquivado. Pause ou revise a assinatura.");
        if (current.nextDueDate <= today)
          throw Error(
            "Vencimento ultrapassado sem emissão. Revise a assinatura antes de continuar.",
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
          details: { source: "recurring", subscriptionId: current.id },
        });
        return created;
      });
      if (!invoice) {
        skipped.push({ id: sub.id, reason: "changed or inactive meanwhile" });
        continue;
      }
      if (
        invoice.status !== "draft" ||
        invoice.bankRequest ||
        invoice.providerId
      )
        throw Error(
          "A fatura deste período já possui emissão, tentativa ou cancelamento. Confira no detalhe antes de continuar.",
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
      try {
        await reconcileCharge(invoice.id, sub.actorId, undefined, "scheduled");
      } catch {
        /* Processing remains pending for the reconciliation cron. */
      }
    } catch (error) {
      failed++;
      errors.push({ id: sub.id, error: error instanceof Error ? error.message : String(error) });
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
  return { today, selected: rows.map((r) => r.id), issued, failed, skipped, errors };
}
