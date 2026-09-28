import {
  listHref,
  pageQuery,
  scalarParam,
  setPageParams,
  type SearchParams,
} from "../list-query";

export type CompanyStatusFilter = "all" | "active" | "archived";
export const companyFilters: CompanyStatusFilter[] = [
  "all",
  "active",
  "archived",
];
export const companyStatusLabels: Record<CompanyStatusFilter, string> = {
  all: "Todas as situações",
  active: "Ativos",
  archived: "Arquivados",
};
export function companyQuery(params: SearchParams) {
  const scalar = (key: string) => scalarParam(params, key);
  return {
    status: (companyFilters.includes(scalar("status") as CompanyStatusFilter)
      ? scalar("status")
      : "active") as CompanyStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    ...pageQuery(params),
  };
}
export type CompanyQuery = ReturnType<typeof companyQuery>;
export function companyListHref({ status, search, page, pageSize }: CompanyQuery) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (search) params.set("q", search);
  return listHref("/empresas", setPageParams(params, { page, pageSize }));
}
