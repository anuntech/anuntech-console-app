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
import { getActor, allowedIds } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
import { paymentUrl } from "@/lib/payment-link";
import {
  invoiceListHref,
  invoicePeriodRange,
  invoiceQuery,
  type InvoiceDisplayStatus,
  type InvoiceStatusFilter,
} from "@/lib/invoice-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import {
  InvoiceMetrics,
  type InvoiceMetric,
} from "@/components/financeiro/invoice-metrics";
import { InvoicesTable } from "@/components/financeiro/invoices-table";
export const metadata: Metadata = {
  title: "Financeiro",
  description:
    "Consulte faturas, vencimentos e pagamentos das empresas com acesso autorizado.",
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
  const total = totals[query.status].count;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
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
        publicId: invoices.publicId,
        publicEnabled: invoices.publicEnabled,
        subscriptionId: invoices.subscriptionId,
        subscriptionStatus: subscriptions.status,
        interval: subscriptions.interval,
        bankRequested: sql<boolean>`(${invoices.bankRequest} is not null)`,
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
      .offset((page - 1) * query.pageSize),
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
        title="Faturas"
        count={totals.all.count}
        description={
          actor.admin
            ? "Cobranças de cada cliente: emissão no Inter, avisos e pagamento."
            : "As cobranças da sua empresa e os dados para pagamento."
        }
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
      />
      <InvoiceMetrics
        metrics={metrics}
        active={query.status}
        hrefFor={(status) => invoiceListHref({ ...query, status, page: 1 })}
      />
      <InvoicesTable
        rows={list.map((row) => ({
          id: row.id,
          description: row.description,
          companyId: row.companyId,
          company: row.company,
          amountCents: row.amountCents,
          status: row.status,
          display: row.display as InvoiceDisplayStatus,
          dueDate: row.dueDate,
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
