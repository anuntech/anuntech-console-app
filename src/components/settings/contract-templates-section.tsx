import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { contractTemplates, contracts } from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import { synovaDraftsToConfirm, synovaWithoutTerms } from "@/lib/service-terms/terms-queries";
import { ContractTemplatesTable } from "./contract-templates-table";
import { SynovaTerms } from "./synova-terms";

/** The model contracts Anuntech starts from. */
export async function ContractTemplatesSection() {
  await requireAdmin();
  const [synova, drafts] = await Promise.all([synovaWithoutTerms(), synovaDraftsToConfirm()]);
  const rows = await db
    .select({
      id: contractTemplates.id,
      name: contractTemplates.name,
      description: contractTemplates.description,
      body: contractTemplates.body,
      active: contractTemplates.active,
      // A one-table select writes its columns unqualified: the outer id is spelled out.
      uses: sql<number>`(select count(*)::int from ${contracts} c where c.template_id = console_contract_templates.id)`,
    })
    .from(contractTemplates)
    .where(sql`true`)
    .orderBy(asc(contractTemplates.name));
  void eq;
  return (
    <>
      <SynovaTerms companies={synova.map((row) => ({ name: row.company, document: row.document }))} drafts={drafts} />
      <ContractTemplatesTable rows={rows.sort((a, b) => Number(b.active) - Number(a.active))} />
    </>
  );
}
