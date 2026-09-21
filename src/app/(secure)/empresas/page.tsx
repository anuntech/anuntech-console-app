import type { Metadata } from "next";
import { db } from "@/lib/db";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { companies } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { Heading } from "@/components/ui";
import CrudCompanyManager from "@/components/crud-company-manager";
import { companyQuery } from "@/lib/company-table";
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
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      document: companies.document,
      billingEmail: companies.billingEmail,
      archived: companies.archived,
    })
    .from(companies)
    .where(scope ?? sql`true`)
    .orderBy(asc(companies.name))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);
  return (
    <>
      <Heading
        eyebrow="CLIENTES"
        title="Empresas"
        description="Cadastros, contatos financeiros e pessoas com acesso ao Console."
        action={{ label: "Cadastrar empresa", href: "/empresas/nova" }}
      />
      <CrudCompanyManager
        rows={rows}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
      />
    </>
  );
}
