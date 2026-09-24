export type ContractStatus = "draft" | "sent" | "signed" | "cancelled";
export type ContractKind = "contract" | "amendment";
/** The situation filters; "expiring" and "expired" derive from the end date. */
export type ContractStatusFilter = "all" | ContractStatus | "expiring" | "expired";
export const contractFilters: ContractStatusFilter[] = [
  "all",
  "sent",
  "signed",
  "expiring",
  "expired",
  "draft",
  "cancelled",
];
export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Rascunho",
  sent: "Aguardando assinatura",
  signed: "Assinado",
  cancelled: "Cancelado",
};
export const contractFilterLabels: Record<ContractStatusFilter, string> = {
  all: "Todas as situações",
  sent: "Aguardando assinatura",
  signed: "Assinados",
  expiring: "Vencendo em 30 dias",
  expired: "Vencidos",
  draft: "Rascunhos",
  cancelled: "Cancelados",
};
/** Clients never see drafts or cancellations. */
export const clientContractFilters: ContractStatusFilter[] = ["all", "sent", "signed"];
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
export function contractQuery(params: Record<string, string | string[] | undefined>) {
  const scalar = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const company = scalar("company");
  return {
    status: (contractFilters.includes(scalar("status") as ContractStatusFilter)
      ? scalar("status")
      : "all") as ContractStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
  };
}
export type ContractQuery = ReturnType<typeof contractQuery>;
export function contractListHref({ status, search, company }: ContractQuery) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  return `/contratos${params.size ? `?${params}` : ""}`;
}
