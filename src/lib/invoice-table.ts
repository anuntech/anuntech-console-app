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
