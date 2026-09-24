import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, contractSignatures, contracts, engagements } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { contractQuery } from "@/lib/contract-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { ContractsTable } from "@/components/contratos/contracts-table";
export const metadata: Metadata = {
  title: "Contratos",
  description: "Os contratos de cada cliente: rascunho, assinatura e versão final.",
};

export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const ids = allowedIds(actor, "finance");
  const query = contractQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const where = and(
    actor.admin
      ? undefined
      : ids.length
        ? and(inArray(contracts.companyId, ids), inArray(contracts.status, ["sent", "signed"]))
        : sql`false`,
    query.status === "all" ? undefined : eq(contracts.status, query.status),
    query.company ? eq(contracts.companyId, query.company) : undefined,
    search ? or(ilike(contracts.title, `%${search}%`), ilike(companies.name, `%${search}%`)) : undefined,
  );
  const [rows, companyFilter] = await Promise.all([
    db
      .select({
        id: contracts.id,
        title: contracts.title,
        companyId: contracts.companyId,
        company: companies.name,
        engagement: engagements.name,
        status: contracts.status,
        updatedAt: contracts.updatedAt,
      })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .leftJoin(engagements, eq(engagements.id, contracts.engagementId))
      .where(where)
      .orderBy(desc(contracts.updatedAt))
      .limit(300),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  const signatures = rows.length
    ? await db
        .select({ contractId: contractSignatures.contractId, party: contractSignatures.party })
        .from(contractSignatures)
        .where(inArray(contractSignatures.contractId, rows.map((row) => row.id)))
    : [];
  return (
    <>
      <PageHeader
        title="Contratos"
        count={rows.length}
        description={
          actor.admin
            ? "Do modelo à assinatura das duas partes, com o PDF final guardado."
            : "Leia, assine e baixe os contratos da sua empresa com a Anuntech."
        }
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/contratos/novo">
                <PlusIcon />
                Novo contrato
              </Link>
            </Button>
          )
        }
      />
      <ContractsTable
        rows={rows.map((row) => ({
          ...row,
          updatedAt: row.updatedAt.toISOString(),
          signedBy: signatures.filter((s) => s.contractId === row.id).map((s) => s.party),
        }))}
        query={query}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        companyFilter={companyFilter}
        now={new Date().toISOString()}
      />
    </>
  );
}
