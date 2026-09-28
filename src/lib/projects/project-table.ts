import {
  DEFAULT_PAGE_SIZE,
  listHref,
  pageQuery,
  scalarParam,
  setPageParams,
  type PageQuery,
  type SearchParams,
} from "../list-query";

export type ProjectStatusFilter = "all" | "active" | "paused" | "completed";
export const projectFilters: ProjectStatusFilter[] = [
  "active",
  "paused",
  "completed",
  "all",
];
export const projectFilterLabels: Record<ProjectStatusFilter, string> = {
  active: "Ativos",
  paused: "Pausados",
  completed: "Concluídos",
  all: "Todas as situações",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The filters of /projetos and /produtos (both lists of engagements). */
export function projectQuery(params: SearchParams) {
  const company = scalarParam(params, "company");
  const status = scalarParam(params, "status");
  return {
    status: (projectFilters.includes(status as ProjectStatusFilter)
      ? status
      : "active") as ProjectStatusFilter,
    search: scalarParam(params, "q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
  };
}
export type ProjectQuery = ReturnType<typeof projectQuery>;
/** Filters plus the page, as the list pages read them from the URL. */
export type ProjectListQuery = ProjectQuery & PageQuery;
export const projectListQuery = (params: SearchParams): ProjectListQuery => ({
  ...projectQuery(params),
  ...pageQuery(params),
});
/** The list URL; `page` and `size` are optional so links from elsewhere can name only the filters. */
export function projectListHref(
  { status, search, company, page = 1, pageSize = DEFAULT_PAGE_SIZE }: ProjectQuery & Partial<PageQuery>,
  base: "/projetos" | "/produtos" = "/projetos",
) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  return listHref(base, setPageParams(params, { page, pageSize }));
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
/**
 * Up to four companies whose name holds the search, accents ignored: typing a
 * company's name offers a one-click narrowing to it ("Só desta empresa").
 */
export function companyShortcuts<T extends { name: string }>(companies: T[], search: string) {
  const needle = fold(search.trim());
  return needle ? companies.filter((company) => fold(company.name).includes(needle)).slice(0, 4) : [];
}
