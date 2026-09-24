import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, invoices, companies, auditEvents } from "@/db/schema";
import { saoPauloDate } from "./dates";
import { issueDate } from "./recurrence";
import { publishInvoice } from "./billing-publish";
import { reconcileCharge } from "./billing-sync";

export async function processSubscriptions() {
  const today = saoPauloDate();
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 5);
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.nextDueDate, horizon.toISOString().slice(0, 10)),
      ),
    )
    .limit(2);
  let issued = 0,
    failed = 0;
  for (const sub of rows) {
    if (issueDate(sub.nextDueDate, sub.leadDays) > today) continue;
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
      if (!invoice) continue;
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
    }
  }
  return { issued, failed };
}
