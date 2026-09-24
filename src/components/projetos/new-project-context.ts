import "server-only";
import { accessibleCompanies, requireAdmin } from "@/lib/access";
import type { ProjectCompanyOption } from "./project-form";

export type NewProjectSearchParams = Promise<{ companyId?: string }>;

/** Active clients a project can belong to, and a preselected one. */
export async function newProjectContext(
  searchParams: NewProjectSearchParams,
): Promise<{ companies: ProjectCompanyOption[]; companyId?: string }> {
  const actor = await requireAdmin();
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));
  const { companyId } = await searchParams;
  return {
    companies,
    companyId: companies.some((c) => c.id === companyId) ? companyId : undefined,
  };
}
