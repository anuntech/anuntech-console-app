import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { contractTemplates, engagements } from "@/db/schema";
import { accessibleCompanies, requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import type { NewContractData } from "./contract-sheet";

export type NewContractSearchParams = Promise<{ companyId?: string; engagementId?: string }>;

/** Companies, active templates and each company's items, for the creation form. */
export async function newContractContext(searchParams: NewContractSearchParams): Promise<NewContractData> {
  const actor = await requireAdmin();
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));
  const [templates, items, params] = await Promise.all([
    db
      .select({
        id: contractTemplates.id,
        name: contractTemplates.name,
        description: contractTemplates.description,
      })
      .from(contractTemplates)
      .where(eq(contractTemplates.active, true))
      .orderBy(asc(contractTemplates.name)),
    companies.length
      ? db
          .select({
            id: engagements.id,
            name: engagements.name,
            kind: engagements.kind,
            companyId: engagements.companyId,
          })
          .from(engagements)
          .where(inArray(engagements.companyId, companies.map((c) => c.id)))
          .orderBy(asc(engagements.name))
      : [],
    searchParams,
  ]);
  return {
    companies,
    templates,
    engagements: items,
    companyId: companies.some((c) => c.id === params.companyId) ? params.companyId : undefined,
    engagementId: items.some((e) => e.id === params.engagementId) ? params.engagementId : undefined,
  };
}
