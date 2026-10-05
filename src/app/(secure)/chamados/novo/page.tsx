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
  const quote = context.kind === "new_project";
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Chamados", href: "/chamados" }, { label: quote ? "Pedir orçamento" : "Novo" }]}
        title={quote ? "Pedir orçamento" : "Novo chamado"}
        description={quote ? "Conte o que você precisa. A equipe conversa com você e prepara um orçamento." : "Como podemos ajudar?"}
      />
      <NewTicketForm context={context} />
    </>
  );
}
