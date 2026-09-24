export type InvoiceTableStatus = "draft" | "issued" | "paid" | "cancelled";
export type InvoiceDisplayStatus = InvoiceTableStatus | "overdue" | "scheduled";

// Overdue is a display state only; payment confirmation still comes from Inter.
export function invoiceDisplayStatus(
  invoice: { status: InvoiceTableStatus; dueDate: string; scheduled?: boolean },
  today: string,
): InvoiceDisplayStatus {
  if (invoice.status === "draft" && invoice.scheduled) return "scheduled";
  return invoice.status === "issued" && invoice.dueDate < today
    ? "overdue"
    : invoice.status;
}

export type InvoiceStatusFilter = "all" | InvoiceDisplayStatus;
export const invoiceFilters: InvoiceStatusFilter[] = [
  "all",
  "issued",
  "overdue",
  "paid",
  "scheduled",
  "draft",
  "cancelled",
];
/** Drafts and cancellations are internal; clients only ever see the rest. */
export const clientInvoiceFilters: InvoiceStatusFilter[] = [
  "all",
  "issued",
  "overdue",
  "paid",
];
export const invoiceStatusLabels: Record<InvoiceDisplayStatus, string> = {
  issued: "Em aberto",
  overdue: "Vencida",
  paid: "Paga",
  scheduled: "Agendada",
  draft: "Rascunho",
  cancelled: "Cancelada",
};
export const invoiceFilterLabels: Record<InvoiceStatusFilter, string> = {
  all: "Todas as situações",
  issued: "Em aberto",
  overdue: "Vencidas",
  paid: "Pagas",
  scheduled: "Agendadas",
  draft: "Rascunhos",
  cancelled: "Canceladas",
};
/** Due-date windows; "custom" reads `from`/`to`. */
export type InvoicePeriod =
  | "all"
  | "this_month"
  | "last_month"
  | "next_30"
  | "this_year"
  | "custom";
export const invoicePeriods: InvoicePeriod[] = [
  "all",
  "this_month",
  "last_month",
  "next_30",
  "this_year",
  "custom",
];
export const invoicePeriodLabels: Record<InvoicePeriod, string> = {
  all: "Todo o período",
  this_month: "Este mês",
  last_month: "Mês passado",
  next_30: "Próximos 30 dias",
  this_year: "Este ano",
  custom: "Personalizado",
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invoiceQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const page = Number(scalar("page"));
  const size = Number(scalar("size"));
  const company = scalar("company");
  const from = ISO_DATE.test(scalar("de")) ? scalar("de") : "";
  const to = ISO_DATE.test(scalar("ate")) ? scalar("ate") : "";
  const period = invoicePeriods.includes(scalar("periodo") as InvoicePeriod)
    ? (scalar("periodo") as InvoicePeriod)
    : from || to
      ? "custom"
      : "all";
  return {
    status: (invoiceFilters.includes(scalar("status") as InvoiceStatusFilter)
      ? scalar("status")
      : "all") as InvoiceStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
    period,
    from: period === "custom" ? from : "",
    to: period === "custom" ? to : "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50, 100].includes(size) ? size : 10,
  };
}
export type InvoiceQuery = ReturnType<typeof invoiceQuery>;
export function invoiceListHref({
  status,
  search,
  company,
  period,
  from,
  to,
  page,
  pageSize,
}: InvoiceQuery) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  if (period !== "all") params.set("periodo", period);
  if (period === "custom" && from) params.set("de", from);
  if (period === "custom" && to) params.set("ate", to);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 10) params.set("size", String(pageSize));
  return `/financeiro${params.size ? `?${params}` : ""}`;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};
/** The due-date window a query asks for, given today's civil date. Null means no limit. */
export function invoicePeriodRange(
  query: Pick<InvoiceQuery, "period" | "from" | "to">,
  today: string,
): { from: string | null; to: string | null } {
  const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const monthStart = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 0)));
  switch (query.period) {
    case "this_month":
      return { from: monthStart(year, month), to: monthEnd(year, month) };
    case "last_month": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    }
    case "next_30":
      return { from: today, to: shift(today, 30) };
    case "this_year":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "custom":
      return { from: query.from || null, to: query.to || null };
    default:
      return { from: null, to: null };
  }
}
