"use server";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, billingNotices, companies, engagements, invoices, subscriptions } from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import {
  INVOICE_BANK_EVENTS,
  INVOICE_DELETE_REFUSAL,
  invoiceDeletionBlock,
} from "./deletion-rules";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes for good an invoice that never reached the Inter: a draft, or a
 * draft that was cancelled. Nothing is sent to the bank or to anyone. Its
 * billing notices go with it. A draft of a recurrence that was never
 * activated takes that recurrence along (it has nothing else); a draft of a
 * recurrence that already ran is refused: the cron would bill that period
 * again once the recurrence resumes, so pause or cancel it instead.
 * Staff only; the audit event keeps the description, amount, due date and
 * company so the log still reads after the row is gone. With `from=list` the
 * list stays where it is (filters and page) and refreshes; otherwise the
 * answer carries `href` back to the list.
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
      if (bankEvents > 0) throw new Refusal(INVOICE_DELETE_REFUSAL);
      let recurrence: string | null = null;
      if (invoice.subscriptionId) {
        const [sub] = await tx
          .select({ id: subscriptions.id, status: subscriptions.status })
          .from(subscriptions)
          .where(eq(subscriptions.id, invoice.subscriptionId))
          .for("update");
        if (sub) {
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
          subscriptionId: invoice.subscriptionId,
          recurrenceDeleted: !!recurrence,
          engagementId: invoice.engagementId,
        },
      });
      return invoice;
    });
    const success = "Rascunho de fatura excluído.";
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
    if (!(e instanceof Refusal)) console.error("[delete] invoice failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir a fatura. Tente novamente.",
    };
  }
}
