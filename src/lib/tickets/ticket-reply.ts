import "server-only";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../db";
import { attachments, auditEvents, messages, tickets } from "@/db/schema";
import { canSeeTicket, type Actor } from "../access/access";
import { logDatabaseFault } from "../action-errors";
import { DOCUMENT_ATTACHMENTS } from "./attachment-rules";
import { takeTicketUploads, type prepareTicketFiles } from "./ticket-files";
import { enqueueTicketNotice, scheduleTicketNotices, ticketOpener } from "./ticket-notifications";
import { loadCalendar } from "../service-terms/terms";
import { pauseToAdd, ticketDues } from "../service-terms/ticket-clock";

type PreparedFile = Awaited<ReturnType<typeof prepareTicketFiles>>[number];
export type ReplyResult = { error: string } | { success: string };

/**
 * The ticket leaves "waiting for the client": the wait joins the pause where
 * the conditions pause the clock (SUP 6.4), and the deadlines move by it.
 */
async function resumeClock(
  ticket: typeof tickets.$inferSelect,
  now: Date,
  tx: Pick<typeof db, "select">,
) {
  const cleared = { waitingFor: null, waitingSince: null };
  if (!ticket.terms || !ticket.waitingSince) return cleared;
  const cal = await loadCalendar(tx);
  const pausedMinutes = ticket.pausedMinutes + pauseToAdd(ticket.terms, ticket.waitingSince, now, cal);
  return { ...cleared, pausedMinutes, ...ticketDues({ ...ticket, pausedMinutes }, cal) };
}

/**
 * A reply on a ticket, with text, files or both: the web's replyTicket and
 * the app's tickets.reply. A client's answer takes a waiting ticket back to
 * the team; the team's first written answer is the first response.
 */
export async function replyToTicket(
  actor: Actor,
  input: { ticketId: string; body: string; uploadIds?: string[]; files?: PreparedFile[] },
): Promise<ReplyResult> {
  const result = await db.transaction(async (tx): Promise<ReplyResult> => {
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, input.ticketId))
      .for("update");
    if (!ticket || !canSeeTicket(actor, ticket))
      return { error: "Você não tem permissão para fazer isso." };
    if (ticket.status === "closed")
      return {
        error:
          "O chamado está encerrado. Abra um novo chamado para continuar o atendimento.",
      };
    let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
    try {
      uploaded = await takeTicketUploads(tx, actor.user.id, input.uploadIds ?? []);
    } catch (error) {
      return {
        error:
          error instanceof Error && !logDatabaseFault("ticket uploads", error)
            ? error.message
            : "Não foi possível ler os anexos. Selecione os arquivos de novo.",
      };
    }
    const files = [...(input.files ?? []), ...uploaded];
    if (!input.body && !files.length)
      return { error: "Escreva uma resposta ou anexe um arquivo." };
    if (
      files.length > DOCUMENT_ATTACHMENTS.max ||
      files.reduce((n, f) => n + f.size, 0) > DOCUMENT_ATTACHMENTS.maxBytes
    )
      return { error: "Selecione até 5 anexos, com no máximo 20 MB no total." };
    if (files.length) {
      const [total] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(attachments)
        .where(eq(attachments.ticketId, ticket.id));
      if (total.n + files.length > 20)
        return { error: "Limite de 20 anexos por chamado atingido." };
    }
    if (input.body)
      await tx.insert(messages).values({
        ticketId: ticket.id,
        body: input.body,
        authorId: actor.user.id,
      });
    if (files.length)
      await tx.insert(attachments).values(
        files.map((file) => ({
          ...file,
          ticketId: ticket.id,
          authorId: actor.user.id,
        })),
      );
    const now = new Date();
    // A client's answer takes a waiting ticket back to the team, and reopens a resolved one.
    const back = !actor.admin && (ticket.status === "waiting_customer" || ticket.status === "resolved");
    const clock = back ? await resumeClock(ticket, now, tx) : {};
    await tx
      .update(tickets)
      .set({
        updatedAt: now,
        ...(back ? { status: "open" as const, ...clock } : {}),
        // The team's first written answer is the first response the contract counts.
        ...(actor.admin && input.body && !ticket.firstResponseAt ? { firstResponseAt: now } : {}),
      })
      .where(eq(tickets.id, ticket.id));
    const [event] = await tx
      .insert(auditEvents)
      .values({
        actorId: actor.user.id,
        companyId: ticket.companyId,
        action: input.body ? "ticket.replied" : "ticket.attachment_added",
        entityId: ticket.id,
      })
      .returning({ id: auditEvents.id });
    await enqueueTicketNotice(
      tx,
      event.id,
      ticket,
      actor.user.name,
      input.body ? "Nova resposta no chamado" : "Novo anexo no chamado",
      actor.admin ? await ticketOpener(tx, ticket, actor.user.email) : null,
    );
    return { success: input.body ? "Resposta enviada." : "Anexo enviado." };
  });
  revalidatePath(`/chamados/${input.ticketId}`);
  revalidatePath("/chamados");
  revalidatePath("/painel", "layout");
  if ("success" in result) scheduleTicketNotices();
  return result;
}
