import "server-only";
import { inArray } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, requireAdmin } from "@/lib/access";
import type {
  InvoiceCompanyOption,
  InvoiceEngagementOption,
} from "./invoice-form";

export type NewInvoiceSearchParams = Promise<{ companyId?: string }>;

/** Active clients to bill, their products/projects, and a preselected client. */
export async function newInvoiceContext(
  searchParams: NewInvoiceSearchParams,
): Promise<{
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
}> {
  const actor = await requireAdmin();
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));
  const items = companies.length
    ? await db
        .select({
          id: engagements.id,
          name: engagements.name,
          companyId: engagements.companyId,
        })
        .from(engagements)
        .where(
          inArray(
            engagements.companyId,
            companies.map((c) => c.id),
          ),
        )
        .orderBy(engagements.name)
    : [];
  const { companyId } = await searchParams;
  return {
    companies,
    engagements: items,
    companyId: companies.some((c) => c.id === companyId) ? companyId : undefined,
  };
}
