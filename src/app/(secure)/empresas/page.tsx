import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { companies, memberships, tickets } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { PageHeader } from "@/components/console/page-header";
import { CompaniesTable } from "@/components/empresas/companies-table";
import { NewCompanyButton } from "@/components/empresas/company-sheet";
import { companyQuery } from "@/lib/company-table";
import { OPEN_TICKET_STATUSES } from "@/lib/ticket-status";
export const metadata: Metadata = {
  title: "Empresas",
  description:
    "Consulte os clientes e gerencie cadastros e acessos por empresa.",
};

export default async function Companies({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const query = companyQuery(await searchParams);
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const scope = and(
    query.status === "all"
      ? undefined
      : eq(companies.archived, query.status === "archived"),
    search
      ? or(
          ilike(companies.name, `%${search}%`),
          ilike(companies.document, `%${search}%`),
          ilike(companies.billingEmail, `%${search}%`),
        )
      : undefined,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(companies)
    .where(scope ?? sql`true`);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const list = await db
    .select({
      id: companies.id,
      name: companies.name,
      document: companies.document,
      billingEmail: companies.billingEmail,
      phone: companies.phone,
      billingAddress: companies.billingAddress,
      autoIssueNfse: companies.autoIssueNfse,
      archived: companies.archived,
    })
    .from(companies)
    .where(scope ?? sql`true`)
    .orderBy(asc(companies.name))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);
  const ids = list.map((c) => c.id);
  const [people, open] = ids.length
    ? await Promise.all([
        db
          .select({ companyId: memberships.companyId, n: count() })
          .from(memberships)
          .where(
            and(
              inArray(memberships.companyId, ids),
              eq(memberships.active, true),
            ),
          )
          .groupBy(memberships.companyId),
        db
          .select({ companyId: tickets.companyId, n: count() })
          .from(tickets)
          .where(
            and(
              inArray(tickets.companyId, ids),
              inArray(tickets.status, OPEN_TICKET_STATUSES),
            ),
          )
          .groupBy(tickets.companyId),
      ])
    : [[], []];
  const peopleBy = new Map(people.map((r) => [r.companyId, r.n]));
  const openBy = new Map(open.map((r) => [r.companyId, r.n]));
  const rows = list.map((c) => ({
    ...c,
    people: peopleBy.get(c.id) ?? 0,
    openTickets: openBy.get(c.id) ?? 0,
  }));
  return (
    <>
      <PageHeader
        title="Empresas"
        count={total}
        description="Clientes, contatos financeiros e quem acessa o Console por eles."
        actions={
          <Suspense>
            <NewCompanyButton />
          </Suspense>
        }
      />
      <CompaniesTable
        rows={rows}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
      />
    </>
  );
}
