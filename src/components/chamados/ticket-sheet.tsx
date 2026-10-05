"use client";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { createTicket } from "@/lib/actions";
import { TicketFields } from "./ticket-form";
import type { TicketFormContext } from "./new-ticket-context";
import { useTicketUploads } from "./ticket-uploads";

/** Opens a ticket in a side sheet, the same surface Empresas uses to create. */
export function TicketSheet({
  context,
  open,
  onOpenChange,
}: {
  context: TicketFormContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const uploads = useTicketUploads();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={context.kind === "new_project" ? "Pedir orçamento" : "Novo chamado"}
      description={context.kind === "new_project" ? "Conte o que você precisa. A equipe conversa com você e prepara um orçamento." : "Como podemos ajudar?"}
      action={createTicket}
      prepare={uploads}
      submitLabel={context.kind === "new_project" ? "Enviar pedido" : "Abrir chamado"}
      pendingLabel="Abrindo…"
    >
      <TicketFields context={context} autoFocus />
    </FormSheet>
  );
}

/**
 * /chamados/novo reached by navigation: the sheet slides over the current
 * page and closing returns to it. Success navigates to the new ticket.
 */
export function NewTicketSheet({ context }: { context: TicketFormContext }) {
  const sheet = useRouteSheet();
  return <TicketSheet context={context} {...sheet} />;
}
