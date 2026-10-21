import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { quoteTableQuery } from "@/lib/quotes/quote-table";
import { listQuotes } from "@/lib/quotes/quote-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { QuotesTable } from "@/components/orcamentos/quotes-table";
export const metadata: Metadata = {
  title: "Orçamentos",
  description: "Propostas por fases e horas, enviadas ao cliente e respondidas pelo Console.",
};

export default async function Quotes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const { list, paged, total, pageCount, ids, companyFilter, today } = await listQuotes(actor, quoteTableQuery(await searchParams));
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Orçamentos"
        count={total}
      />
      <QuotesTable
        actions={
          actor.admin ? (
            <Button asChild>
              <Link href="/orcamentos/novo" data-assistant-action="">
                <PlusIcon />
                Novo orçamento
              </Link>
            </Button>
          ) : (
            // A client asks through a ticket of its own kind; the team answers with a quote here.
            <Button asChild>
              <Link href="/chamados/novo?tipo=novo-projeto">
                <PlusIcon />
                Pedir orçamento
              </Link>
            </Button>
          )
        }
        rows={list}
        query={paged}
        total={total}
        pageCount={pageCount}
        admin={actor.admin}
        multiCompany={ids.length > 1}
        companyFilter={companyFilter}
        now={new Date().toISOString()}
        today={today}
      />
    </>
  );
}
