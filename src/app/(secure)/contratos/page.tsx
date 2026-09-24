import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { companies, contractSignatures, contracts, engagements } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
import { addDays, contractQuery, EXPIRY_WARNING_DAYS } from "@/lib/contract-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { ContractCards } from "@/components/contratos/contract-cards";
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
  const ids = allowedIds(actor, "finance");
  const query = contractQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  if (!actor.admin) query.status = "all";
  const today = saoPauloDate();
  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const expiring = and(eq(contracts.status, "signed"), gte(contracts.endsAt, today), lte(contracts.endsAt, horizon));
  const expired = and(eq(contracts.status, "signed"), lt(contracts.endsAt, today));
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const parents = alias(contracts, "parents");
  const where = and(
    actor.admin
      ? undefined
      : ids.length
        ? and(inArray(contracts.companyId, ids), inArray(contracts.status, ["sent", "signed"]))
        : sql`false`,
    query.status === "all"
      ? undefined
      : query.status === "expiring"
        ? expiring
        : query.status === "expired"
          ? expired
          : eq(contracts.status, query.status),
    query.company ? eq(contracts.companyId, query.company) : undefined,
    search ? or(ilike(contracts.title, `%${search}%`), ilike(companies.name, `%${search}%`)) : undefined,
  );
  const [rows, companyFilter, alerts] = await Promise.all([
    db
      .select({
        id: contracts.id,
        title: contracts.title,
        kind: contracts.kind,
        parentId: contracts.parentId,
        parentTitle: parents.title,
        companyId: contracts.companyId,
        company: companies.name,
        engagement: engagements.name,
        status: contracts.status,
        startsAt: contracts.startsAt,
        endsAt: contracts.endsAt,
        documentHash: contracts.documentHash,
        updatedAt: contracts.updatedAt,
      })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .leftJoin(engagements, eq(engagements.id, contracts.engagementId))
      .leftJoin(parents, eq(parents.id, contracts.parentId))
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
    actor.admin
      ? Promise.all([
          db.select({ n: count() }).from(contracts).where(expiring),
          db.select({ n: count() }).from(contracts).where(expired),
        ]).then(([a, b]) => ({ expiring: a[0].n, expired: b[0].n }))
      : { expiring: 0, expired: 0 },
  ]);
  const signatures = rows.length
    ? await db
        .select({
          contractId: contractSignatures.contractId,
          party: contractSignatures.party,
          hash: contractSignatures.documentHash,
        })
        .from(contractSignatures)
        .where(inArray(contractSignatures.contractId, rows.map((row) => row.id)))
    : [];
  const list = rows.map(({ documentHash, ...row }) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    signedBy: signatures.filter((s) => s.contractId === row.id && s.hash === documentHash).map((s) => s.party),
  }));
  return (
    <>
      <PageHeader
        title="Contratos"
        count={rows.length}
        description={
          actor.admin
            ? "Do modelo à assinatura das duas partes, com aditivos, versões e alerta de vencimento."
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
      {actor.admin ? (
        <ContractsTable
          rows={list}
          query={query}
          alerts={alerts}
          companyFilter={companyFilter}
          now={new Date().toISOString()}
          today={today}
        />
      ) : (
        <ContractCards rows={list} query={query} showCompany={ids.length > 1} today={today} />
      )}
    </>
  );
}
