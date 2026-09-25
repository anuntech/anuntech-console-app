"use client";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { createTicket } from "@/lib/actions";
import { TicketFields, type TicketCompanyOption } from "./ticket-form";
import { useTicketUploads } from "./ticket-uploads";

/** Opens a ticket in a side sheet, the same surface Empresas uses to create. */
export function TicketSheet({
  companies,
  companyId,
  open,
  onOpenChange,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const uploads = useTicketUploads();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Novo chamado"
      description="Como podemos ajudar?"
      action={createTicket}
      prepare={uploads}
      submitLabel="Abrir chamado"
      pendingLabel="Abrindo…"
    >
      <TicketFields companies={companies} companyId={companyId} autoFocus />
    </FormSheet>
  );
}

/**
 * /chamados/novo reached by navigation: the sheet slides over the current
 * page and closing returns to it. Success navigates to the new ticket.
 */
export function NewTicketSheet({
  companies,
  companyId,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
}) {
  const sheet = useRouteSheet();
  return <TicketSheet companies={companies} companyId={companyId} {...sheet} />;
}
