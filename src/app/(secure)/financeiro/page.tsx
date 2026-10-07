import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  Clock3Icon,
  MailCheckIcon,
  PlusIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, invoices, subscriptions } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { paymentUrl } from "@/lib/billing/payment-link";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { canDeleteInvoice, closedAtBank, recurrenceAllowsDelete } from "@/lib/deletion-rules";
import {
  invoiceListHref,
  invoicePeriodRange,
  clientInvoiceFilters,
  invoiceQuery,
  type InvoiceDisplayStatus,
  type InvoiceStatusFilter,
} from "@/lib/billing/invoice-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import {
  InvoiceMetrics,
  type InvoiceMetric,
} from "@/components/financeiro/invoice-metrics";
import { InvoicesTable } from "@/components/financeiro/invoices-table";
import { UpcomingCharges } from "@/components/financeiro/upcoming-charges";
import { upcomingCharges } from "@/lib/billing/upcoming-charges";
export const metadata: Metadata = {
  title: "Financeiro",
  description:
    "Faturas, vencimentos e pagamentos de cada empresa.",
};

export default async function Finance({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = invoiceQuery(await searchParams);
  const today = saoPauloDate();
  const actor = await getActor();
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
  const displayStatus = sql<string>`case when ${invoices.status} = 'draft' and ${subscriptions.status} = 'active' then 'scheduled' when ${invoices.status} = 'issued' and ${invoices.dueDate} < ${today} then 'overdue' else ${invoices.status} end`;
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
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((rows) => rows[0] ?? null)
      : null,
  ]);
  const metrics: InvoiceMetric[] = [
    {
      status: "issued",
      label: "Em aberto",
      icon: <Clock3Icon />,
      ...totals.issued,
    },
    {
      status: "overdue",
      label: "Vencidas",
      tone: "destructive",
      icon: <TriangleAlertIcon />,
      ...totals.overdue,
    },
    actor.admin
      ? {
          status: "scheduled",
          label: "Agendadas",
          icon: <CalendarClockIcon />,
          ...totals.scheduled,
        }
      : {
          status: "all",
          label: "Todas",
          icon: <ReceiptTextIcon />,
          ...totals.all,
        },
    {
      status: "paid",
      label: "Pagas",
      tone: "success",
      icon: <CircleCheckIcon />,
      ...totals.paid,
    },
  ];
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Faturas"
        count={total}
      />
      <InvoiceMetrics
        metrics={metrics}
        active={query.status}
        hrefFor={(status) => invoiceListHref({ ...query, status, page: 1 })}
      />
      <UpcomingCharges charges={upcoming} team={actor.admin} showCompany={(actor.admin || ids.length > 1) && !query.company} />
      <InvoicesTable
        actions={
          actor.admin && (
            <>
              <Button variant="outline" asChild>
                <Link href="/financeiro/envios">
                  <MailCheckIcon />
                  Envios
                </Link>
              </Button>
              <Button asChild>
                <Link href="/financeiro/nova">
                  <PlusIcon />
                  Nova cobrança
                </Link>
              </Button>
            </>
          )
        }
        rows={list.map((row) => ({
          id: row.id,
          description: row.description,
          companyId: row.companyId,
          company: row.company,
          amountCents: row.amountCents,
          status: row.status,
          display: row.display as InvoiceDisplayStatus,
          dueDate: row.dueDate,
          bankDueDate: row.bankDueDate,
          recurring: !!row.subscriptionId,
          terms: {
            discountCents: row.discountCents,
            fineBps: row.fineBps,
            interestMonthlyBps: row.interestMonthlyBps,
          },
          interval: row.interval,
          publicUrl:
            row.publicId &&
            row.publicEnabled &&
            ["issued", "paid"].includes(row.status)
              ? paymentUrl(row.publicId)
              : null,
          editable:
            row.status === "draft" &&
            !row.bankRequested &&
            (!row.subscriptionId || row.subscriptionStatus === "draft")
              ? "draft"
              : row.status === "issued"
                ? "issued"
                : null,
          cancellable: row.status === "draft" && !row.bankRequested,
          // A recurrence must not bill the period again; the action refuses it too.
          deletable:
            actor.admin &&
            canDeleteInvoice({ ...row, bankRequest: row.bankRequested }) &&
            recurrenceAllowsDelete(
              row,
              row.subscriptionStatus && row.subscriptionNextDueDate
                ? { status: row.subscriptionStatus, nextDueDate: row.subscriptionNextDueDate }
                : null,
            ),
          bankClosed: closedAtBank(row),
        }))}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
        today={today}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        companyFilter={companyFilter}
      />
    </>
  );
}
