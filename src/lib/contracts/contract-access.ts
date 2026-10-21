import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, contractTemplates, contracts, engagements } from "@/db/schema";
import { canAccess, type Actor } from "../access/access";

/**
 * One contract with its company, product and template, or null when it does
 * not exist or is out of reach (both answer "not found"): the finance area of
 * its company and, for clients, never a draft or a cancellation. Used by
 * /contratos/[id] and the app's contracts.get.
 */
export async function findContract(actor: Actor, id: string) {
  const [row] = await db
    .select({
      contract: contracts,
      company: companies,
      engagement: engagements.name,
      template: contractTemplates.name,
    })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .leftJoin(engagements, eq(engagements.id, contracts.engagementId))
    .leftJoin(contractTemplates, eq(contractTemplates.id, contracts.templateId))
    .where(eq(contracts.id, id));
  if (!row || !canAccess(actor, row.contract.companyId, "finance")) return null;
  if (!actor.admin && (row.contract.status === "draft" || row.contract.status === "cancelled")) return null;
  return row;
}
