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
export function projectQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const company = scalar("company");
  return {
    status: (projectFilters.includes(scalar("status") as ProjectStatusFilter)
      ? scalar("status")
      : "active") as ProjectStatusFilter,
    search: scalar("q").trim().slice(0, 160),
    company: UUID.test(company) ? company.toLowerCase() : "",
  };
}
export type ProjectQuery = ReturnType<typeof projectQuery>;
export function projectListHref(
  { status, search, company }: ProjectQuery,
  base: "/projetos" | "/produtos" = "/projetos",
) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (company) params.set("company", company);
  if (search) params.set("q", search);
  return `${base}${params.size ? `?${params}` : ""}`;
}
