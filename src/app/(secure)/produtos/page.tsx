import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, engagements, subscriptions } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { companyShortcuts, projectListQuery } from "@/lib/projects/project-table";
import { engagementLinks } from "@/lib/record-links";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { ProductsList } from "@/components/produtos/products-list";
export const metadata: Metadata = {
  title: "Produtos e serviços",
  description: "Os produtos e serviços que cada empresa tem com a Anuntech.",
};

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const ids = actor.grants.map((g) => g.company.id);
  const query = projectListQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const showCompany = actor.admin || ids.length > 1;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const where = and(
    inArray(engagements.kind, ["product", "service"]),
    actor.admin ? undefined : ids.length ? inArray(engagements.companyId, ids) : sql`false`,
    query.status === "all" ? undefined : eq(engagements.status, query.status),
    query.company ? eq(engagements.companyId, query.company) : undefined,
    search
      ? or(ilike(engagements.name, `%${search}%`), ilike(companies.name, `%${search}%`))
      : undefined,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(where);
  const paging = { ...query, ...clampPage(query, total) };
  const [rows, companyFilter, shortcuts] = await Promise.all([
    db
      .select({
        id: engagements.id,
        kind: engagements.kind,
        name: engagements.name,
        status: engagements.status,
        description: engagements.description,
        url: engagements.url,
        amountCents: sql<number | null>`coalesce(${subscriptions.amountCents}, ${engagements.amountCents})`,
        interval: subscriptions.interval,
        nextDueDate: subscriptions.nextDueDate,
        subscriptionId: engagements.subscriptionId,
        companyId: engagements.companyId,
        company: companies.name,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
      .where(where)
      // The id breaks ties between equal names, so pages never overlap.
      .orderBy(asc(engagements.name), asc(engagements.id))
      .limit(paging.pageSize)
      .offset(offsetOf(paging)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
    // The companies behind every match (not only this page), for the "Só desta empresa" shortcuts.
    query.search && !query.company && showCompany
      ? db
          .selectDistinct({ id: companies.id, name: companies.name })
          .from(engagements)
          .innerJoin(companies, eq(companies.id, engagements.companyId))
          .where(where)
          .orderBy(asc(companies.name))
          .then((found) => companyShortcuts(found, query.search))
      : [],
  ]);
  // Staff see "Excluir" only where nothing billed or signed points at the item.
  const links = actor.admin ? await engagementLinks(rows.map((row) => row.id)) : null;
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Produtos e serviços"
        count={total}
      />
      <ProductsList
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/produtos/novo">
                <PlusIcon />
                Vincular
              </Link>
            </Button>
          )
        }
        rows={rows.map((row) => ({
          ...row,
          kind: row.kind === "service" ? "service" : "product",
          links: links?.get(row.id),
        }))}
        query={paging}
        total={total}
        pageCount={pageCountOf(total, paging.pageSize)}
        admin={actor.admin}
        showCompany={showCompany}
        companyFilter={companyFilter}
        companyShortcuts={shortcuts}
      />
    </>
  );
}
