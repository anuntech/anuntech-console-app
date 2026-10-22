import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { companies, invoices, subscriptions } from "@/db/schema";
import { allowedIds, type Actor } from "../access/access";
import { clampPage, offsetOf, pageCountOf } from "../list-query";
import {
  invoicePeriodRange,
  clientInvoiceFilters,
  type InvoiceQuery,
  type InvoiceStatusFilter,
} from "./invoice-table";
import { upcomingCharges } from "./upcoming-charges";
import { expiredDebtCondition } from "./billing-watch";

/**
 * The invoices a person sees, one page at a time, with the totals of each
 * situation: the web's /financeiro and the app's finance.list. Clients see
 * only their finance companies' issued and paid invoices (a Membro, none).
 */
export async function listInvoices(actor: Actor, input: InvoiceQuery, today: string) {
  const query = { ...input };
  const ids = allowedIds(actor, "finance");
  if (!actor.admin && query.company && !ids.includes(query.company))
    query.company = "";
  // Clients never see drafts; a shared staff link with ?status=draft shows everything instead of nothing.
  if (!actor.admin && !clientInvoiceFilters.includes(query.status)) query.status = "all";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const range = invoicePeriodRange(query, today);
  const scope =
    and(
      range.from ? gte(invoices.dueDate, range.from) : undefined,
      range.to ? lte(invoices.dueDate, range.to) : undefined,
      actor.admin
        ? undefined
        : ids.length
          ? and(
              inArray(invoices.companyId, ids),
              inArray(invoices.status, ["issued", "paid"]),
            )
          : sql`false`,
      query.company ? eq(invoices.companyId, query.company) : undefined,
      search
        ? or(
            ilike(invoices.description, `%${search}%`),
            ilike(companies.name, `%${search}%`),
          )
        : undefined,
    ) ?? sql`true`;
  // "expired": Inter closed it unpaid and nobody decided yet (lib/billing/billing-watch.ts); staff only.
  const displayStatus = sql<string>`case when ${invoices.status} = 'draft' and ${subscriptions.status} = 'active' then 'scheduled' when ${invoices.status} = 'issued' and ${invoices.dueDate} < ${today} then 'overdue' when ${expiredDebtCondition} then 'expired' else ${invoices.status} end`;
  const grouped = await db
    .select({
      status: displayStatus,
      count: count(),
      cents: sql<string>`coalesce(sum(${invoices.amountCents}), 0)`,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(scope)
    .groupBy(sql`1`);
  const totals: Record<InvoiceStatusFilter, { count: number; cents: number }> =
    {
      all: { count: 0, cents: 0 },
      issued: { count: 0, cents: 0 },
      overdue: { count: 0, cents: 0 },
      paid: { count: 0, cents: 0 },
      scheduled: { count: 0, cents: 0 },
      draft: { count: 0, cents: 0 },
      expired: { count: 0, cents: 0 },
      cancelled: { count: 0, cents: 0 },
    };
  for (const row of grouped) {
    const bucket = totals[row.status as InvoiceStatusFilter];
    if (!bucket) continue;
    bucket.count = row.count;
    bucket.cents = Number(row.cents);
    totals.all.count += row.count;
    totals.all.cents += Number(row.cents);
  }
  // Records under every filter, the status included: the header, the footer
  // and the rows agree. The cards keep showing each status's own total.
  const total = totals[query.status].count;
  const pageCount = pageCountOf(total, query.pageSize);
  const { page } = clampPage(query, total);
  // What each recurrence charges next, on the first page of the plain list (a client's own, or ?company=).
  const upcoming =
    !search && page === 1 && (query.status === "all" || query.status === "scheduled")
      ? await upcomingCharges({ admin: actor.admin, companyIds: query.company ? [query.company] : actor.admin ? null : ids })
      : [];
  const [list, companyFilter] = await Promise.all([
    db
      .select({
        id: invoices.id,
        description: invoices.description,
        companyId: invoices.companyId,
        company: companies.name,
        companyDocument: companies.document,
        amountCents: invoices.amountCents,
        discountCents: invoices.discountCents,
        fineBps: invoices.fineBps,
        interestMonthlyBps: invoices.interestMonthlyBps,
        status: invoices.status,
        display: displayStatus,
        dueDate: invoices.dueDate,
        bankDueDate: invoices.bankDueDate,
        publicId: invoices.publicId,
        publicEnabled: invoices.publicEnabled,
        subscriptionId: invoices.subscriptionId,
        subscriptionStatus: subscriptions.status,
        subscriptionNextDueDate: subscriptions.nextDueDate,
        interval: subscriptions.interval,
        bankRequested: sql<boolean>`(${invoices.bankRequest} is not null)`,
        // What proves the invoice never reached the Inter, for "Excluir".
        providerId: invoices.providerId,
        bankBase: invoices.bankBase,
        bankStatus: invoices.bankStatus,
        bankCheckedAt: invoices.bankCheckedAt,
        boletoLine: sql<boolean>`(${invoices.boletoLine} is not null)`,
        pixCopyPaste: sql<boolean>`(${invoices.pixCopyPaste} is not null)`,
        boletoUrl: invoices.boletoUrl,
        boletoPdf: sql<boolean>`(${invoices.boletoPdf} is not null)`,
        fiscalStatus: invoices.fiscalStatus,
        fiscalUrl: invoices.fiscalUrl,
      })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .where(
        and(
          scope,
          query.status !== "all"
            ? sql`${displayStatus} = ${query.status}`
            : undefined,
        ),
      )
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(query.pageSize)
      .offset(offsetOf({ ...query, page })),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name, document: companies.document })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((rows) => rows[0] ?? null)
      : null,
  ]);
  return { ids, query: { ...query, page }, totals, total, pageCount, upcoming, list, companyFilter, search };
}
