import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, engagements } from "@/db/schema";
import { getActor } from "@/lib/access";
import { projectQuery } from "@/lib/project-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { ProductsList } from "@/components/produtos/products-list";
export const metadata: Metadata = {
  title: "Produtos",
  description: "Os produtos que cada empresa tem com a Anuntech.",
};

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const ids = actor.grants.map((g) => g.company.id);
  const query = projectQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const where = and(
    eq(engagements.kind, "product"),
    actor.admin ? undefined : ids.length ? inArray(engagements.companyId, ids) : sql`false`,
    query.status === "all" ? undefined : eq(engagements.status, query.status),
    query.company ? eq(engagements.companyId, query.company) : undefined,
    search
      ? or(ilike(engagements.name, `%${search}%`), ilike(companies.name, `%${search}%`))
      : undefined,
  );
  const [rows, companyFilter] = await Promise.all([
    db
      .select({
        id: engagements.id,
        name: engagements.name,
        status: engagements.status,
        description: engagements.description,
        url: engagements.url,
        companyId: engagements.companyId,
        company: companies.name,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(where)
      .orderBy(asc(engagements.name)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  return (
    <>
      <PageHeader
        title="Produtos"
        count={rows.length}
        description={
          actor.admin
            ? "O que cada cliente contratou, com o link para abrir."
            : "O que sua empresa tem com a Anuntech. Abra pelo link."
        }
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/produtos/novo">
                <PlusIcon />
                Novo produto
              </Link>
            </Button>
          )
        }
      />
      <ProductsList
        rows={rows}
        query={query}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        companyFilter={companyFilter}
      />
    </>
  );
}
