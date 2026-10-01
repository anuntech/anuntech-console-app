import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { companies, memberships, tickets } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { PageHeader } from "@/components/console/page-header";
import { CompaniesTable } from "@/components/empresas/companies-table";
import { NewCompanyButton } from "@/components/empresas/company-sheet";
import { companyQuery } from "@/lib/companies/company-table";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { OPEN_TICKET_STATUSES } from "@/lib/tickets/ticket-status";
import { companyLinks } from "@/lib/record-links";
export const metadata: Metadata = {
  title: "Empresas",
  description:
    "Os clientes, os contatos financeiros e quem acessa o Console por eles.",
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
  const pageCount = pageCountOf(total, query.pageSize);
  const { page } = clampPage(query, total);
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
    // The id breaks ties between equal names, so pages never overlap.
    .orderBy(asc(companies.name), asc(companies.id))
    .limit(query.pageSize)
    .offset(offsetOf({ ...query, page }));
  const ids = list.map((c) => c.id);
  const [people, open, links] = ids.length
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
        // "Excluir" shows only for companies without invoices, contracts or proposals.
        companyLinks(ids),
      ])
    : [[], [], null];
  const peopleBy = new Map(people.map((r) => [r.companyId, r.n]));
  const openBy = new Map(open.map((r) => [r.companyId, r.n]));
  const rows = list.map((c) => ({
    ...c,
    people: peopleBy.get(c.id) ?? 0,
    openTickets: openBy.get(c.id) ?? 0,
    links: links?.get(c.id),
  }));
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Empresas"
        count={total}
      />
      <CompaniesTable
        actions={
          <Suspense>
            <NewCompanyButton />
          </Suspense>
        }
        rows={rows}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
      />
    </>
  );
}
