"use server";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachments,
  auditEvents,
  companies,
  messages,
  ticketNotices,
  tickets,
  timeEntries,
  quotes,
  journeys,
} from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { canDeleteTicket } from "../deletion-rules";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes a ticket for good, in any state, with its messages, attachments
 * (their content lives in the row, so nothing is left in storage) and pending
 * notices. Staff only; the audit event keeps the subject and the company so
 * the log still reads after the row is gone. With `from=list` the list stays
 * where it is (filters and page) and refreshes; otherwise the answer carries
 * `href` back to the list.
 */
export async function deleteTicket(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const ticketId = z.string().uuid().safeParse(form.get("id"));
  if (!ticketId.success) return { error: "Chamado não encontrado." };
  try {
    const deleted = await db.transaction(async (tx) => {
      // Locked so a reply or an upload racing this delete waits, then finds nothing.
      const [ticket] = await tx
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId.data))
        .for("update");
      if (!ticket) throw new Refusal("Chamado não encontrado.");
      if (!canDeleteTicket(ticket.status)) throw new Refusal("Este chamado não pode ser excluído.");
      const [company] = await tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, ticket.companyId));
      const [{ messageCount }] = await tx
        .select({ messageCount: count() })
        .from(messages)
        .where(eq(messages.ticketId, ticket.id));
      const [{ fileCount }] = await tx
        .select({ fileCount: count() })
        .from(attachments)
        .where(eq(attachments.ticketId, ticket.id));
      // Hours logged on it stay in the company's bank, unlinked.
      await tx.update(timeEntries).set({ ticketId: null }).where(eq(timeEntries.ticketId, ticket.id));
      // A proposal it asked for stays, unlinked.
      await tx.update(quotes).set({ ticketId: null }).where(eq(quotes.ticketId, ticket.id));
      await tx.update(journeys).set({ ticketId: null }).where(eq(journeys.ticketId, ticket.id));
      await tx.delete(ticketNotices).where(eq(ticketNotices.ticketId, ticket.id));
      await tx.delete(attachments).where(eq(attachments.ticketId, ticket.id));
      await tx.delete(messages).where(eq(messages.ticketId, ticket.id));
      await tx.delete(tickets).where(eq(tickets.id, ticket.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: ticket.companyId,
        action: "ticket.deleted",
        entityId: ticket.id,
        details: {
          subject: ticket.subject,
          company: company?.name ?? null,
          status: ticket.status,
          engagementId: ticket.engagementId,
          messages: messageCount,
          files: fileCount,
        },
      });
      return ticket;
    });
    const success = "Chamado excluído.";
    // Any revalidation re-renders the page that called the action. From the
    // ticket itself that page is gone (404) and would unmount the dialog
    // before it navigates; the list is dynamic, so going there loads it fresh.
    if (form.get("from") !== "list") return { success, href: "/chamados" };
    revalidatePath("/chamados");
    revalidatePath(`/chamados/${deleted.id}`);
    revalidatePath(`/empresas/${deleted.companyId}`);
    revalidatePath("/painel");
    if (deleted.engagementId) {
      revalidatePath(`/projetos/${deleted.engagementId}`);
      revalidatePath(`/produtos/${deleted.engagementId}`);
    }
    return { success };
  } catch (e) {
    if (!(e instanceof Refusal)) console.error("[delete] ticket failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir o chamado. Tente novamente.",
    };
  }
}
