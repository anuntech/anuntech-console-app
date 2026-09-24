export type ContractStatus = "draft" | "sent" | "signed" | "cancelled";
export type ContractStatusFilter = "all" | ContractStatus;
export const contractFilters: ContractStatusFilter[] = ["all", "sent", "signed", "draft", "cancelled"];
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
  draft: "Rascunhos",
  cancelled: "Cancelados",
};
/** Clients never see drafts or cancellations. */
export const clientContractFilters: ContractStatusFilter[] = ["all", "sent", "signed"];

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
