import "server-only";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { companies, contractTemplates, contracts, engagements } from "@/db/schema";
import { accessibleCompanies, requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import type { NewContractData } from "./contract-sheet";

export type NewContractSearchParams = Promise<{ companyId?: string; engagementId?: string; parentId?: string }>;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Companies, active templates and each company's items, for the creation
 * form. With a valid `parentId`, the form creates an amendment instead.
 */
export async function newContractContext(searchParams: NewContractSearchParams): Promise<NewContractData> {
  const actor = await requireAdmin();
  const allCompanies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));
  const params = await searchParams;
  const parentRow =
    params.parentId && UUID.test(params.parentId)
      ? (
          await db
            .select({ contract: contracts, company: companies.name })
            .from(contracts)
            .innerJoin(companies, eq(companies.id, contracts.companyId))
            .where(and(eq(contracts.id, params.parentId), eq(contracts.status, "signed"), eq(contracts.kind, "contract")))
        )[0]
      : null;
  const [templates, items, amendments] = await Promise.all([
    db
      .select({
        id: contractTemplates.id,
        name: contractTemplates.name,
        description: contractTemplates.description,
      })
      .from(contractTemplates)
      .where(eq(contractTemplates.active, true))
      .orderBy(asc(contractTemplates.name)),
    allCompanies.length
      ? db
          .select({
            id: engagements.id,
            name: engagements.name,
            kind: engagements.kind,
            companyId: engagements.companyId,
          })
          .from(engagements)
          .where(inArray(engagements.companyId, allCompanies.map((c) => c.id)))
          .orderBy(asc(engagements.name))
      : [],
    parentRow
      ? db
          .select({ n: count() })
          .from(contracts)
          .where(and(eq(contracts.parentId, parentRow.contract.id), ne(contracts.status, "cancelled")))
          .then((r) => r[0].n)
      : 0,
  ]);
  return {
    companies: allCompanies,
    templates,
    engagements: items,
    companyId: allCompanies.some((c) => c.id === params.companyId) ? params.companyId : undefined,
    engagementId: items.some((e) => e.id === params.engagementId) ? params.engagementId : undefined,
    parent: parentRow
      ? {
          id: parentRow.contract.id,
          title: parentRow.contract.title,
          companyId: parentRow.contract.companyId,
          company: parentRow.company,
          engagementId: parentRow.contract.engagementId,
          endsAt: parentRow.contract.endsAt,
          amendments,
        }
      : undefined,
  };
}
