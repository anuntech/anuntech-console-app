export type InvoiceTableStatus = "draft" | "issued" | "paid" | "cancelled";
export type InvoiceDisplayStatus = InvoiceTableStatus | "overdue";

// Overdue is a display state only; payment confirmation still comes from Inter.
export function invoiceDisplayStatus(
  invoice: { status: InvoiceTableStatus; dueDate: string },
  today: string,
): InvoiceDisplayStatus {
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
  "draft",
  "cancelled",
];
export function invoiceQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const page = Number(scalar("page"));
  const size = Number(scalar("size"));
  return {
    status: (invoiceFilters.includes(scalar("status") as InvoiceStatusFilter)
      ? scalar("status")
      : "all") as InvoiceStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50, 100].includes(size) ? size : 10,
  };
}
export function invoiceListHref({
  status,
  search,
  page,
  pageSize,
}: {
  status: InvoiceStatusFilter;
  search: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 10) params.set("size", String(pageSize));
  return `/financeiro${params.size ? `?${params}` : ""}`;
}
