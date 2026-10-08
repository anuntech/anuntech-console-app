import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { contractTemplates, contracts } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import { synovaWithoutTerms } from "@/lib/service-terms/terms-queries";
import { ContractTemplatesTable } from "./contract-templates-table";
import { SynovaTerms } from "./synova-terms";

/** The model contracts Anuntech starts from. */
export async function ContractTemplatesSection() {
  await requireAdmin();
  const synova = await synovaWithoutTerms();
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
  return (
    <>
      <SynovaTerms companies={synova.map((row) => row.company)} />
      <ContractTemplatesTable rows={rows.sort((a, b) => Number(b.active) - Number(a.active))} />
    </>
  );
}
