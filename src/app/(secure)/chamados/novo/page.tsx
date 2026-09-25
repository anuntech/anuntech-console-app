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
  const { companies, companyId } = await newTicketContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Chamados", href: "/chamados" }, { label: "Novo" }]}
        title="Novo chamado"
        description="Como podemos ajudar?"
      />
      <NewTicketForm companies={companies} companyId={companyId} />
    </>
  );
}
