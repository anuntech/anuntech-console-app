import { OPEN_TICKET_STATUSES } from "./ticket-status";
import {
  listHref,
  pageQuery,
  scalarParam,
  setPageParams,
  type SearchParams,
} from "../list-query";

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
  open: "Aguardando atendimento",
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
export function ticketQuery(params: SearchParams) {
  const scalar = (key: string) => scalarParam(params, key);
  const company = scalar("company");
  return {
    status: (ticketFilters.includes(scalar("status") as TicketStatusFilter)
      ? scalar("status")
      : "active") as TicketStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
    ...pageQuery(params),
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
  return listHref("/chamados", setPageParams(params, { page, pageSize }));
}
