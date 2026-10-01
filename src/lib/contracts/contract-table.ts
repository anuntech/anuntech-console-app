import {
  DEFAULT_PAGE_SIZE,
  listHref,
  pageQuery,
  scalarParam,
  setPageParams,
  type PageQuery,
  type SearchParams,
} from "../list-query";

export type ContractStatus = "draft" | "sent" | "in_review" | "signed" | "cancelled";
export type ContractKind = "contract" | "amendment";
/** The situation filters; "expiring" and "expired" derive from the end date. */
export type ContractStatusFilter = "all" | ContractStatus | "expiring" | "expired";
export const contractFilters: ContractStatusFilter[] = [
  "all",
  "sent",
  "in_review",
  "signed",
  "expiring",
  "expired",
  "draft",
  "cancelled",
];
export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Rascunho",
  sent: "Aguardando assinatura",
  in_review: "Em revisão",
  signed: "Assinado",
  cancelled: "Cancelado",
};
export const contractFilterLabels: Record<ContractStatusFilter, string> = {
  all: "Todas as situações",
  sent: "Aguardando assinatura",
  in_review: "Em revisão",
  signed: "Assinados",
  expiring: "Vencendo em 30 dias",
  expired: "Vencidos",
  draft: "Rascunhos",
  cancelled: "Cancelados",
};
/** Clients never see drafts or cancellations. */
export const clientContractFilters: ContractStatusFilter[] = ["all", "sent", "in_review", "signed"];
/** What a client sees: everything that went out, including what is back with the team for review. */
export const CLIENT_CONTRACT_STATUSES: ContractStatus[] = ["sent", "in_review", "signed"];
export const contractKindLabels: Record<ContractKind, string> = {
  contract: "Contrato",
  amendment: "Aditivo",
};

/** How many days before the end date a contract counts as expiring. */
export const EXPIRY_WARNING_DAYS = 30;

export type ContractTerm =
  | { state: "none" }
  | { state: "upcoming"; days: number }
  | { state: "active"; days: number }
  | { state: "expiring"; days: number }
  | { state: "expired"; days: number };

const DAY = 86400000;
const civil = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/**
 * Where a signed contract stands against its validity dates on a given day.
 * `days` counts to the end date (negative once it has passed), or to the
 * start date while the term has not begun.
 */
export function contractTerm(
  dates: { startsAt: string | null; endsAt: string | null },
  today: string,
): ContractTerm {
  const now = civil(today);
  const days = dates.endsAt ? Math.round((civil(dates.endsAt) - now) / DAY) : null;
  if (days !== null && days < 0) return { state: "expired", days };
  if (days !== null && days <= EXPIRY_WARNING_DAYS) return { state: "expiring", days };
  if (dates.startsAt && civil(dates.startsAt) > now)
    return { state: "upcoming", days: Math.round((civil(dates.startsAt) - now) / DAY) };
  if (days === null) return { state: "none" };
  return { state: "active", days };
}

/** "Vence em 12 dias", "Vence hoje", "Vencido há 3 dias" … for badges. */
export function contractTermLabel(term: ContractTerm) {
  switch (term.state) {
    case "expiring":
      return term.days === 0 ? "Vence hoje" : term.days === 1 ? "Vence amanhã" : `Vence em ${term.days} dias`;
    case "expired":
      return term.days === -1 ? "Venceu ontem" : `Vencido há ${-term.days} dias`;
    case "upcoming":
      return term.days === 1 ? "Começa amanhã" : `Começa em ${term.days} dias`;
    default:
      return null;
  }
}

/** A civil date `days` after another, ISO. */
export function addDays(iso: string, days: number) {
  return new Date(civil(iso) + days * DAY).toISOString().slice(0, 10);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function contractQuery(params: SearchParams) {
  const company = scalarParam(params, "company");
  const status = scalarParam(params, "status");
  return {
    status: (contractFilters.includes(status as ContractStatusFilter) ? status : "all") as ContractStatusFilter,
    search: scalarParam(params, "q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
    ...pageQuery(params),
  };
}
export type ContractQuery = ReturnType<typeof contractQuery>;
/**
 * The list URL for a query. Paging is optional so links from elsewhere (the
 * company page, the dock) can pass only the filters and land on page 1.
 */
export function contractListHref({
  status,
  search,
  company,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: Omit<ContractQuery, keyof PageQuery> & Partial<PageQuery>) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  return listHref("/contratos", setPageParams(params, { page, pageSize }));
}
