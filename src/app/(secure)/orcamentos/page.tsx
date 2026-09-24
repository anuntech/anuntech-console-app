import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, quotes } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
import { quoteNumberLabel, quoteQuery, quoteTotals } from "@/lib/quote-model";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { QuoteCards } from "@/components/orcamentos/quote-cards";
import { QuotesTable } from "@/components/orcamentos/quotes-table";
import type { QuoteRow } from "@/components/orcamentos/quote-row";
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
  const ids = allowedIds(actor, "finance");
  const query = quoteQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  if (!actor.admin) query.status = "all";
  const today = saoPauloDate();
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const number = query.search.match(/^(\d{4})-(\d{1,3})$/);
  const where = and(
    actor.admin
      ? undefined
      : ids.length
        ? and(inArray(quotes.companyId, ids), inArray(quotes.status, ["sent", "accepted", "declined"]))
        : sql`false`,
    query.status === "all"
      ? undefined
      : query.status === "expired"
        ? and(eq(quotes.status, "sent"), lt(quotes.validUntil, today))
        : eq(quotes.status, query.status),
    query.company ? eq(quotes.companyId, query.company) : undefined,
    search
      ? number
        ? and(eq(quotes.year, Number(number[1])), eq(quotes.seq, Number(number[2])))
        : or(ilike(quotes.title, `%${search}%`), ilike(companies.name, `%${search}%`))
      : undefined,
  );
  const [rows, companyFilter] = await Promise.all([
    db
      .select({
        id: quotes.id,
        year: quotes.year,
        seq: quotes.seq,
        title: quotes.title,
        companyId: quotes.companyId,
        company: companies.name,
        status: quotes.status,
        validUntil: quotes.validUntil,
        content: quotes.content,
        publication: quotes.publication,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(where)
      .orderBy(desc(quotes.updatedAt))
      .limit(300),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  const list: QuoteRow[] = rows.map((row) => {
    const source = row.status === "draft" || !row.publication ? row.content : row.publication;
    const totals = quoteTotals(source);
    return {
      id: row.id,
      number: quoteNumberLabel(row.year, row.seq),
      title: row.title,
      companyId: row.companyId,
      company: row.company,
      status: row.status,
      validUntil: row.validUntil,
      totalCents: totals.totalCents,
      hoursMin: totals.hoursMin,
      hoursMax: totals.hoursMax,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
  return (
    <>
      <PageHeader
        title="Orçamentos"
        count={rows.length}
        description={
          actor.admin
            ? "Propostas por fases e horas, com taxa, entrada e saldo. O cliente aceita pelo Console."
            : "As propostas da Anuntech para a sua empresa: leia, baixe o PDF e responda."
        }
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/orcamentos/novo">
                <PlusIcon />
                Novo orçamento
              </Link>
            </Button>
          )
        }
      />
      {actor.admin ? (
        <QuotesTable rows={list} query={query} companyFilter={companyFilter} now={new Date().toISOString()} today={today} />
      ) : (
        <QuoteCards rows={list} query={query} showCompany={ids.length > 1} today={today} />
      )}
    </>
  );
}
