import "server-only";
import { eq } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { db } from "../../db";
import { allowedIds, type Actor } from "../../access/access";
import { saoPauloDate } from "../../dates";
import { formatDocument } from "../../companies/company-input";
import { companyDisplayName } from "../../companies/display-name";
import { listInvoices } from "../../billing/invoice-list";
import { findInvoice } from "../../billing/invoice-access";
import { invoiceDebt } from "../../billing/invoice-debt";
import { invoiceRecurrence } from "../../billing/invoice-recurrence";
import { paymentUrl } from "../../billing/payment-link";
import {
  invoiceFiscalView,
  invoiceProcessing,
  invoiceRecurrenceView,
  invoiceTermsView,
  overdueDays,
} from "../../billing/invoice-client-view";
import {
  invoiceDisplayStatus,
  invoiceQuery,
  invoiceStatusLabels,
  type InvoiceDisplayStatus,
  type InvoicePeriod,
} from "../../billing/invoice-table";
import { api } from "../server";
import { companyOptions } from "../company-options";
import { guard, missing } from "../access";

type ListRow = Awaited<ReturnType<typeof listInvoices>>["list"][number];
type Status = "all" | "issued" | "overdue" | "paid";
/** The public payment page, as a path: the app adds the Console it talks to. */
const payPath = (i: { publicId: string | null; publicEnabled: boolean; status: string }) =>
  i.publicId && i.publicEnabled && ["issued", "paid"].includes(i.status) ? `/pagar/${i.publicId}` : null;

export function invoiceRow(row: ListRow) {
  const display = row.display as InvoiceDisplayStatus;
  return {
    id: row.id,
    description: row.description,
    // The name people read; the boleto's payer keeps the razão social.
    company: companyDisplayName(row.company, row.companyDocument),
    amountCents: row.amountCents,
    display,
    statusLabel: invoiceStatusLabels[display] ?? row.status,
    dueDate: row.dueDate,
    payPath: payPath(row),
  };
}

/** A Financeiro row: the shared invoice row plus its recurrence and how late it is (as the web's table). */
function financeRow(row: ListRow, today: string) {
  return {
    ...invoiceRow(row),
    interval: row.subscriptionId ? (row.interval ?? "monthly") : null,
    daysOverdue: overdueDays(row.display, row.dueDate, today),
    bankDueDate: row.bankDueDate && row.bankDueDate !== row.dueDate ? row.bankDueDate : null,
  };
}

/** The same list the web shows, for the app: the web's query, with its search, period (de/até) and company. */
export async function invoicePage(
  actor: Actor,
  status: Status,
  page: number,
  pageSize = 25,
  filters: { search?: string; period?: InvoicePeriod; from?: string; to?: string; company?: string } = {},
  today = saoPauloDate(),
) {
  const query = {
    ...invoiceQuery({
      status,
      q: filters.search ?? "",
      periodo: filters.period ?? "all",
      de: filters.from ?? "",
      ate: filters.to ?? "",
      company: filters.company ?? "",
    }),
    page,
    pageSize,
  };
  return listInvoices(actor, query, today);
}

const invoiceCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: invoices.companyId }).from(invoices).where(eq(invoices.id, id)))[0]?.companyId;

export const finance = {
  list: api.finance.list
    // listInvoices keeps a client to their finance companies; a Membro gets none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const today = saoPauloDate();
      const result = await invoicePage(actor, input.status, input.page, 25, input, today);
      const pick = (k: Status) => result.totals[k];
      const ids = new Set(allowedIds(actor, "finance"));
      return {
        rows: result.list.map((row) => financeRow(row, today)),
        totals: { all: pick("all"), issued: pick("issued"), overdue: pick("overdue"), paid: pick("paid") },
        // "Próximas cobranças" is the client's; the team's "Recorrências para corrigir" stays on the web.
        upcoming: actor.admin
          ? []
          : result.upcoming.map((c) => ({
              subscriptionId: c.subscriptionId,
              company: companyDisplayName(c.company, c.companyDocument),
              description: c.description,
              amountCents: c.amountCents,
              dueDate: c.dueDate,
              issueDate: c.issueDate,
              invoiceId: c.invoiceId,
            })),
        page: result.query.page,
        pageCount: result.pageCount,
        showCompany: actor.admin || ids.size > 1,
        // The web's company filter (?company=): clients with several finance companies pick one; the team arrives by link.
        companies: actor.admin ? [] : companyOptions(actor, ids),
        companyFilter: result.companyFilter
          ? { id: result.companyFilter.id, name: companyDisplayName(result.companyFilter.name, result.companyFilter.document) }
          : null,
      };
    }),
  get: api.finance.get
    .use(guard({ area: "finance", company: invoiceCompany }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const row = await findInvoice(actor, input.id);
      if (!row) throw missing();
      const i = row.invoice;
      const today = saoPauloDate();
      const [debt, recurrence] = await Promise.all([
        actor.admin ? invoiceDebt(i) : null,
        invoiceRecurrence(i, today),
      ]);
      const display = invoiceDisplayStatus(
        { status: i.status, dueDate: i.dueDate, expired: debt?.state === "open" },
        today,
      );
      const path = payPath(i);
      const issuedLine = i.status === "issued" && !!i.boletoLine;
      return {
        id: i.id,
        description: i.description,
        company: companyDisplayName(row.company.name, row.company.document),
        engagement: row.engagement,
        amountCents: i.amountCents,
        display,
        statusLabel: invoiceStatusLabels[display] ?? i.status,
        dueDate: i.dueDate,
        bankDueDate: i.bankDueDate && i.bankDueDate !== i.dueDate ? i.bankDueDate : null,
        daysOverdue: overdueDays(display, i.dueDate, today),
        interval: recurrence.sub?.interval ?? null,
        payPath: path,
        payUrl: path && i.publicId ? paymentUrl(i.publicId) : null,
        // Only while it can still be paid; a paid invoice keeps no payment codes on screen.
        pix: i.status === "issued" ? i.pixCopyPaste : null,
        boletoLine: i.status === "issued" ? i.boletoLine : null,
        // The public page caches the PDF; without the link, the web's own route asks the Inter with the session.
        boletoPath: !issuedLine ? null : path ? `${path}/boleto` : i.providerId ? `/api/boletos/${i.id}` : null,
        createdAt: i.createdAt.toISOString(),
        bankCheckedAt: i.bankCheckedAt?.toISOString() ?? null,
        processing: invoiceProcessing(i),
        payer: { name: row.company.name, document: formatDocument(row.company.document) },
        terms: invoiceTermsView(i),
        recurrence: invoiceRecurrenceView(i, recurrence.sub, recurrence.earlyReady, recurrence.ahead),
        fiscal: invoiceFiscalView(i, actor.admin),
      };
    }),
};
