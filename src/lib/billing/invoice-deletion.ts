"use server";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, automationEvents, billingNotices, companies, engagements, invoices, subscriptions } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import {
  INVOICE_BANK_EVENTS,
  INVOICE_DELETE_REFUSAL,
  closedAtBank,
  invoiceDeletionBlock,
  recurrenceAllowsDelete,
} from "../deletion-rules";
import { expiredDebtCondition } from "./billing-watch";
import { releasePreparedCharges } from "./prepared-release";
import { logDatabaseFault } from "../action-errors";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes an invoice for good. Two kinds qualify: one that never reached the
 * Inter (a draft, or a cancelled draft), and a charge the Inter itself
 * closed (cancelled, expired or never issued, as the reconciliation
 * recorded it), so nothing is left to pay. Nothing is sent to the bank or to
 * anyone. Its billing notices go with it.
 *
 * Recurrences: a draft of a recurrence that was never activated takes that
 * recurrence along (it has nothing else); a draft of a recurrence that
 * already ran is refused, since the cron would bill that period again. A
 * closed charge goes only once its recurrence moved past its due date, and
 * never takes the recurrence along.
 *
 * Staff only; the audit event keeps the description, amount, due date,
 * company and the bank's identifiers so the log still reads after the row is
 * gone. With `from=list` the list stays where it is (filters and page) and
 * refreshes; otherwise the answer carries `href` back to the list.
 */
export async function deleteDraftInvoice(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const invoiceId = z.string().uuid().safeParse(form.get("id"));
  if (!invoiceId.success) return { error: "Fatura não encontrada." };
  try {
    const deleted = await db.transaction(async (tx) => {
      // Locked like `publishInvoice` does, so an emission racing this delete
      // either lands first (and blocks it) or finds nothing to emit.
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId.data))
        .for("update");
      if (!invoice) throw new Refusal("Fatura não encontrada.");
      const block = invoiceDeletionBlock(invoice);
      if (block) throw new Refusal(block);
      // Inter closed it unpaid and nobody decided yet: deleting would make the debt vanish.
      const [debt] = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, invoice.id), sql`${expiredDebtCondition}`));
      if (debt) throw new Refusal("Esta fatura é uma dívida em aberto. Cobre de novo ou encerre a dívida antes de excluir.");
      const closed = closedAtBank(invoice);
      // A reissue clears the bank columns; the history still says it was there.
      const [{ bankEvents }] = await tx
        .select({ bankEvents: count() })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, invoice.id),
            inArray(auditEvents.action, INVOICE_BANK_EVENTS),
          ),
        );
      if (bankEvents > 0 && !closed) throw new Refusal(INVOICE_DELETE_REFUSAL);
      let recurrence: string | null = null;
      if (invoice.subscriptionId) {
        const [sub] = await tx
          .select({
            id: subscriptions.id,
            status: subscriptions.status,
            nextDueDate: subscriptions.nextDueDate,
          })
          .from(subscriptions)
          .where(eq(subscriptions.id, invoice.subscriptionId))
          .for("update");
        if (sub && closed) {
          if (!recurrenceAllowsDelete(invoice, sub))
            throw new Refusal(
              "A recorrência ainda vai cobrar este vencimento. Excluir a fatura faria o período ser cobrado de novo; ajuste o próximo vencimento ou cancele a recorrência antes.",
            );
        } else if (sub) {
          const [{ others }] = await tx
            .select({ others: count() })
            .from(invoices)
            .where(and(eq(invoices.subscriptionId, sub.id), ne(invoices.id, invoice.id)));
          if (sub.status !== "draft" || others > 0)
            throw new Refusal(
              "Esta cobrança faz parte de uma recorrência que já rodou. Excluir o rascunho faria o período ser cobrado de novo; pause ou cancele a recorrência na fatura.",
            );
          recurrence = sub.id;
        }
      }
      const [company] = await tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, invoice.companyId));
      await tx.delete(billingNotices).where(eq(billingNotices.invoiceId, invoice.id));
      // Its own debt decision goes with it; a draft prepared from a debt, a proposal or a contract gives that source back.
      await tx
        .delete(automationEvents)
        .where(and(eq(automationEvents.entityId, invoice.id), inArray(automationEvents.kind, ["debt.closed", "debt.rebilled"])));
      await releasePreparedCharges(tx, invoice.id);
      await tx.delete(invoices).where(eq(invoices.id, invoice.id));
      if (recurrence) {
        // Never activated and this was its only charge: nothing else reaches it.
        await tx.update(engagements).set({ subscriptionId: null }).where(eq(engagements.subscriptionId, recurrence));
        await tx.delete(subscriptions).where(eq(subscriptions.id, recurrence));
      }
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: invoice.companyId,
        action: "invoice.deleted",
        entityId: invoice.id,
        details: {
          description: invoice.description,
          company: company?.name ?? null,
          amountCents: invoice.amountCents,
          dueDate: invoice.dueDate,
          status: invoice.status,
          bankStatus: invoice.bankStatus,
          providerId: invoice.providerId,
          subscriptionId: invoice.subscriptionId,
          recurrenceDeleted: !!recurrence,
          engagementId: invoice.engagementId,
        },
      });
      return invoice;
    });
    const success = closedAtBank(deleted) ? "Fatura cancelada excluída." : "Rascunho de fatura excluído.";
    // Any revalidation re-renders the page that called the action. From the
    // invoice itself that page is gone (404) and would unmount the dialog
    // before it navigates; the list is dynamic, so going there loads it fresh.
    if (form.get("from") !== "list") return { success, href: "/financeiro" };
    revalidatePath("/financeiro");
    revalidatePath(`/financeiro/${deleted.id}`);
    revalidatePath(`/empresas/${deleted.companyId}`);
    revalidatePath("/painel");
    if (deleted.engagementId) {
      revalidatePath(`/projetos/${deleted.engagementId}`);
      revalidatePath(`/produtos/${deleted.engagementId}`);
    }
    return { success };
  } catch (e) {
    // A query's error prints its values; the database's own code and index are enough.
    if (!(e instanceof Refusal) && !logDatabaseFault("delete invoice", e)) console.error("[delete] invoice failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir a fatura. Tente novamente.",
    };
  }
}
