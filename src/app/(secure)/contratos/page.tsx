import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { contractQuery } from "@/lib/contracts/contract-table";
import { listContracts } from "@/lib/contracts/contract-list";
import { Button } from "@/components/ui/button";
import { listLayoutFor } from "@/lib/list-layout-server";
import { PageHeader } from "@/components/console/page-header";
import { ContractsTable } from "@/components/contratos/contracts-table";
export const metadata: Metadata = {
  title: "Contratos",
  description: "Os contratos de cada cliente: rascunho, assinatura, aditivos e vigência.",
};

export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const view = await listLayoutFor("contracts");
  const result = await listContracts(actor, contractQuery(await searchParams));
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Contratos"
        count={result.total}
      />
      <ContractsTable
        view={view}
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/contratos/novo" data-assistant-action="">
                <PlusIcon />
                Novo contrato
              </Link>
            </Button>
          )
        }
        rows={result.list}
        query={result.query}
        total={result.total}
        pageCount={result.pageCount}
        admin={actor.admin}
        showCompany={result.showCompany}
        alerts={result.alerts}
        companyFilter={result.companyFilter}
        now={new Date().toISOString()}
        today={result.today}
      />
    </>
  );
}
