import { OPEN_TICKET_STATUSES } from "./ticket-status";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "resolved"
  | "closed";
export type TicketPriority = "normal" | "high";
/** "active" groups everything that still needs attention; it is the default. */
export type TicketStatusFilter = "active" | "all" | TicketStatus;
export const ticketFilters: TicketStatusFilter[] = [
  "active",
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
  "all",
];
export const ticketFilterLabels: Record<TicketStatusFilter, string> = {
  active: "Em aberto",
  open: "Abertos",
  in_progress: "Em atendimento",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvidos",
  closed: "Encerrados",
  all: "Todas as situações",
};
/** Statuses a filter value stands for; `undefined` means no restriction. */
export function ticketFilterStatuses(
  filter: TicketStatusFilter,
): readonly TicketStatus[] | undefined {
  if (filter === "all") return undefined;
  if (filter === "active") return OPEN_TICKET_STATUSES;
  return [filter];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ticketQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const page = Number(scalar("page"));
  const size = Number(scalar("size"));
  const company = scalar("company");
  return {
    status: (ticketFilters.includes(scalar("status") as TicketStatusFilter)
      ? scalar("status")
      : "active") as TicketStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50, 100].includes(size) ? size : 25,
  };
}
export type TicketQuery = ReturnType<typeof ticketQuery>;
export function ticketListHref({
  status,
  search,
  company,
  page,
  pageSize,
}: TicketQuery) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 25) params.set("size", String(pageSize));
  return `/chamados${params.size ? `?${params}` : ""}`;
}
