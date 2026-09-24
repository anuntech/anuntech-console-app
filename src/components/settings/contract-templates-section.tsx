import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { contractTemplates, contracts } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { ContractTemplatesTable } from "./contract-templates-table";

/** The model contracts Anuntech starts from. */
export async function ContractTemplatesSection() {
  await requireAdmin();
  const rows = await db
    .select({
      id: contractTemplates.id,
      name: contractTemplates.name,
      description: contractTemplates.description,
      body: contractTemplates.body,
      active: contractTemplates.active,
      uses: sql<number>`(select count(*)::int from ${contracts} where ${contracts.templateId} = ${contractTemplates.id})`,
    })
    .from(contractTemplates)
    .where(sql`true`)
    .orderBy(asc(contractTemplates.name));
  void eq;
  return <ContractTemplatesTable rows={rows.sort((a, b) => Number(b.active) - Number(a.active))} />;
}
