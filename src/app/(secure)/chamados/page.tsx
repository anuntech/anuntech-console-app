import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { TicketsTable } from "@/components/chamados/tickets-table";
import { ticketQuery } from "@/lib/tickets/ticket-table";
import { listTickets } from "@/lib/tickets/ticket-list";
import { companyDisplayName } from "@/lib/companies/display-name";
export const metadata: Metadata = {
  title: "Chamados",
  description:
    "Os chamados e as conversas com a equipe da Anuntech.",
};

export default async function Tickets({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const now = new Date();
  const list = await listTickets(actor, ticketQuery(await searchParams), now);
  // Names as people read them; the search still looks in the razão social.
  const rows = list.rows.map((row) => ({ ...row, company: companyDisplayName(row.company, row.companyDocument) }));
  const companyFilter = list.companyFilter && { ...list.companyFilter, name: companyDisplayName(list.companyFilter.name, list.companyFilter.document) };
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Chamados"
        count={list.total}
      />
      <TicketsTable
        actions={
          list.canCreate && (
            <Button asChild>
              <Link href="/chamados/novo" data-assistant-action="">
                <PlusIcon />
                Abrir chamado
              </Link>
            </Button>
          )
        }
        rows={rows}
        query={list.query}
        total={list.total}
        pageCount={list.pageCount}
        now={now.toISOString()}
        admin={actor.admin}
        showCompany={list.showCompany}
        canCreate={list.canCreate}
        companyFilter={companyFilter}
      />
    </>
  );
}
