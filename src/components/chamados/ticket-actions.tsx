"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { updateTicket } from "@/lib/actions";
import type { TicketStatus } from "@/lib/ticket-table";

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
