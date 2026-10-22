import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClockIcon, CalendarClockIcon, CircleCheckIcon, Clock3Icon, MailCheckIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { listInvoices } from "@/lib/billing/invoice-list";
import { saoPauloDate } from "@/lib/dates";
import { paymentUrl } from "@/lib/billing/payment-link";
import { canDeleteInvoice, closedAtBank, recurrenceAllowsDelete } from "@/lib/deletion-rules";
import {
  invoiceListHref,
  invoiceQuery,
  type InvoiceDisplayStatus,
} from "@/lib/billing/invoice-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import {
  InvoiceMetrics,
  type InvoiceMetric,
} from "@/components/financeiro/invoice-metrics";
import { InvoicesTable } from "@/components/financeiro/invoices-table";
import { UpcomingCharges } from "@/components/financeiro/upcoming-charges";
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
  const { ids, totals, total, pageCount, upcoming, list, companyFilter, query: listed } = await listInvoices(actor, query, today);
  const page = listed.page;
  Object.assign(query, listed);
  // The client has no "Todas" tile: the count beside the title is that total, and the
  // situation filter clears back to it.
  const metrics: (InvoiceMetric | false)[] = [
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
    actor.admin && {
      status: "scheduled",
      label: "Agendadas",
      icon: <CalendarClockIcon />,
      ...totals.scheduled,
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
        metrics={metrics.filter((metric): metric is InvoiceMetric => !!metric)}
        active={query.status}
        hrefFor={(status) => invoiceListHref({ ...query, status, page: 1 })}
      />
      <UpcomingCharges charges={upcoming} team={actor.admin} showCompany={(actor.admin || ids.length > 1) && !query.company} />
      <InvoicesTable
        actions={
          actor.admin && (
            <>
              <Button variant="outline" asChild>
                <Link href="/financeiro/atrasos">
                  <AlarmClockIcon />
                  Atrasos
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/financeiro/envios">
                  <MailCheckIcon />
                  Envios
                </Link>
              </Button>
              <Button asChild>
                <Link href="/financeiro/nova" data-assistant-action="">
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
          companyDocument: row.companyDocument,
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
            row.display !== "expired" &&
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
