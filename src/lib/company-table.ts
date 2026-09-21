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
export function companyQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const page = Number(scalar("page"));
  const size = Number(scalar("size"));
  return {
    status: (companyFilters.includes(scalar("status") as CompanyStatusFilter)
      ? scalar("status")
      : "active") as CompanyStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50, 100].includes(size) ? size : 10,
  };
}
export function companyListHref({
  status,
  search,
  page,
  pageSize,
}: {
  status: CompanyStatusFilter;
  search: string;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 10) params.set("size", String(pageSize));
  return `/empresas${params.size ? `?${params}` : ""}`;
}
