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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invoiceQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const page = Number(scalar("page"));
  const size = Number(scalar("size"));
  const company = scalar("company");
  return {
    status: (invoiceFilters.includes(scalar("status") as InvoiceStatusFilter)
      ? scalar("status")
      : "all") as InvoiceStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50, 100].includes(size) ? size : 10,
  };
}
export type InvoiceQuery = ReturnType<typeof invoiceQuery>;
export function invoiceListHref({
  status,
  search,
  company,
  page,
  pageSize,
}: InvoiceQuery) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 10) params.set("size", String(pageSize));
  return `/financeiro${params.size ? `?${params}` : ""}`;
}
