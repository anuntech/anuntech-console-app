"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { updateTicket } from "@/lib/actions";
import { deleteTicket } from "@/lib/tickets/ticket-deletion";
import type { TicketStatus } from "@/lib/tickets/ticket-table";

/**
 * Moves a ticket between situations from menu items and buttons through one
 * hidden form. Menus close on select, so the submit waits a tick.
 */
export function useTicketMove(ticketId: string) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const move = (next: TicketStatus) =>
    setTimeout(() => {
      flushSync(() => setStatus(next));
      formRef.current?.requestSubmit();
    }, 0);
  const form = (
    <ServerForm ref={formRef} action={updateTicket}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="status" value={status} />
    </ServerForm>
  );
  return { move, form };
}

/** Closing has consequences for the client, so it is the one move that asks. */
export function CloseTicketDialog({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      action={updateTicket}
      fields={{ ticketId, status: "closed" }}
      title="Encerrar chamado?"
      description="A conversa fica só para consulta: ninguém responde nem anexa arquivos. Você pode reabrir depois."
      confirmLabel="Encerrar"
      destructive
    />
  );
}

const counted = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Deleting takes the conversation and its files with it, for good. Staff
 * only; the server refuses anyone else. From the list it stays on the list
 * (filters and page); from the ticket it goes back to the list.
 */
export function DeleteTicketDialog({
  ticketId,
  subject,
  open,
  onOpenChange,
  counts,
  fromList = false,
}: {
  ticketId: string;
  subject: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When the page already has them; otherwise the text stays general. */
  counts?: { messages: number; files: number };
  fromList?: boolean;
}) {
  const parts = counts
    ? [
        counts.messages ? counted(counts.messages, "mensagem", "mensagens") : "",
        counts.files ? counted(counts.files, "anexo", "anexos") : "",
      ].filter(Boolean)
    : [];
  const what = parts.length ? parts.join(" e ") : "a conversa e os anexos";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      action={deleteTicket}
      fields={fromList ? { id: ticketId, from: "list" } : { id: ticketId }}
      title="Excluir chamado?"
      description={`O chamado “${subject}” será apagado com ${what}. Isso não pode ser desfeito.`}
      confirmLabel="Excluir"
      destructive
    />
  );
}
