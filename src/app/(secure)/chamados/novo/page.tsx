import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewTicketForm } from "@/components/chamados/ticket-form";
import {
  newTicketContext,
  type NewTicketSearchParams,
} from "@/components/chamados/new-ticket-context";
export const metadata: Metadata = { title: "Novo chamado" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewTicket({
  searchParams,
}: {
  searchParams: NewTicketSearchParams;
}) {
  const context = await newTicketContext(searchParams);
  // No description: the form's first question asks what the person needs, and the
  // "App ou projeto novo" option already says the team prepares a quote.
  const quote = context.kind === "new_project";
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Chamados", href: "/chamados" }]}
        title={quote ? "Pedir orçamento" : "Novo chamado"}
      />
      <NewTicketForm context={context} />
    </>
  );
}
