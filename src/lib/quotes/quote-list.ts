import "server-only";
import { and, count, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { companies, quotes } from "@/db/schema";
import { allowedIds, type Actor } from "../access/access";
import { saoPauloDate } from "../dates";
import { clampPage, offsetOf, pageCountOf } from "../list-query";
import { quoteNumberLabel, quoteTotals } from "./quote-model";
import { quoteFiltersFor, type quoteTableQuery } from "./quote-table";

/**
 * The quotes a person sees, one page at a time, with the figures the client
 * was sent: the web's /orcamentos and the app's quotes.list. Clients see their
 * finance companies' quotes that went out (sent, accepted, declined).
 */
export async function listQuotes(actor: Actor, input: ReturnType<typeof quoteTableQuery>) {
  const ids = allowedIds(actor, "finance");
  const query = { ...input };
  // Clients can only narrow within their own companies, and only by the situations they can see.
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  if (!quoteFiltersFor(actor.admin).includes(query.status)) query.status = "all";
  const today = saoPauloDate();
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const number = query.search.match(/^(\d{4})-(\d{1,3})$/);
  const where =
    and(
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
    ) ?? sql`true`;
  // The count joins companies like the page does, since the search matches company names.
  const [{ total }] = await db
    .select({ total: count() })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    .where(where);
  const paged = { ...query, ...clampPage(query, total) };
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
      // The id breaks ties, so a row never shows on two pages or on none.
      .orderBy(desc(quotes.updatedAt), desc(quotes.id))
      .limit(paged.pageSize)
      .offset(offsetOf(paged)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  const list = rows.map((row) => {
    // The figures the client was sent; a draft shows what it would send.
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
  return { list, paged, total, pageCount: pageCountOf(total, paged.pageSize), ids, companyFilter, today };
}
