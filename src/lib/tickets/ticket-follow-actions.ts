"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, automationEvents, messages, tickets } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { updateTicket } from "../actions";
import { enqueueTicketNotice, scheduleTicketNotices } from "./ticket-notifications";

/*
 * The team's follow-up on a ticket that waits: remind the client of what is
 * missing, close a request nobody answered, or say a finished ticket took
 * no hours. Each is a click; nothing here runs on its own.
 */

const blocked = { error: "Você não tem permissão para fazer isso." };
const id = z.string().uuid();

/** Sends the request for what is missing again, at most once a day. */
export async function remindClient(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const ticketId = id.safeParse(form.get("ticketId"));
  if (!ticketId.success) return blocked;
  try {
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx.select().from(tickets).where(eq(tickets.id, ticketId.data)).for("update");
      if (!ticket) return blocked;
      if (ticket.status !== "waiting_customer") return { error: "O chamado não está esperando o cliente." };
      const [claimed] = await tx
        .insert(automationEvents)
        .values({ kind: "ticket.client_reminder", entityId: `${ticket.id}:${saoPauloDate()}`, companyId: ticket.companyId, actorId: actor.user.id })
        .onConflictDoNothing()
        .returning({ id: automationEvents.id });
      if (!claimed) return { error: "O cliente já foi lembrado hoje." };
      const [event] = await tx
        .insert(auditEvents)
        .values({ actorId: actor.user.id, companyId: ticket.companyId, action: "ticket.client_reminded", entityId: ticket.id })
        .returning({ id: auditEvents.id });
      await enqueueTicketNotice(tx, event.id, ticket, actor.user.name, "Lembrete: a equipe ainda precisa de você", null, ticket.waitingFor ? `O que falta: ${ticket.waitingFor}` : null);
      return { success: "Lembrete enviado ao cliente." };
    });
    if ("success" in result) {
      scheduleTicketNotices();
      revalidatePath(`/chamados/${ticketId.data}`);
    }
    return result;
  } catch {
    return { error: "Não foi possível lembrar o cliente." };
  }
}

const NO_REPLY =
  "Como não tivemos retorno, marcamos este chamado como resolvido. Se ainda precisar, é só responder aqui: o chamado volta para a equipe.";

/** Resolves (not closes) a ticket nobody answered: an answer from the client reopens it. */
export async function closeForNoReply(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const ticketId = id.safeParse(form.get("ticketId"));
  if (!ticketId.success) return blocked;
  const [ticket] = await db.select({ status: tickets.status }).from(tickets).where(eq(tickets.id, ticketId.data));
  if (!ticket) return blocked;
  if (ticket.status !== "waiting_customer") return { error: "O chamado não está esperando o cliente." };
  await db.insert(messages).values({ ticketId: ticketId.data, authorId: actor.user.id, body: NO_REPLY });
  const moved = new FormData();
  moved.set("ticketId", ticketId.data);
  moved.set("status", "resolved");
  const result = await updateTicket({}, moved);
  return result.error ? result : { success: "Chamado resolvido por falta de resposta. Se o cliente responder, ele reabre." };
}

/** A finished ticket that took no hours leaves the "sem horas" list. */
export async function markNoHours(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  const ticketId = id.safeParse(form.get("ticketId"));
  if (!ticketId.success) return blocked;
  const [ticket] = await db.select({ companyId: tickets.companyId }).from(tickets).where(and(eq(tickets.id, ticketId.data)));
  if (!ticket) return blocked;
  await db
    .insert(automationEvents)
    .values({ kind: "ticket.no_hours", entityId: ticketId.data, companyId: ticket.companyId, actorId: actor.user.id })
    .onConflictDoNothing();
  revalidatePath(`/chamados/${ticketId.data}`);
  revalidatePath("/painel");
  return { success: "Marcado como sem horas." };
}
