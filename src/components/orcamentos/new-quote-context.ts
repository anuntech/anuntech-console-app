import "server-only";
import { accessibleCompanies, requireAdmin } from "@/lib/access/access";
import type { NewQuoteData } from "./quote-sheet";

export type NewQuoteSearchParams = Promise<{ companyId?: string }>;

/** Clients a proposal can be for, and a preselected one (from the company page). */
export async function newQuoteContext(searchParams: NewQuoteSearchParams): Promise<NewQuoteData> {
  const actor = await requireAdmin();
  const { companyId } = await searchParams;
  // Archived clients stay out of the picker unless asked for by id.
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived || c.id === companyId)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  return {
    companies,
    companyId: companies.some((c) => c.id === companyId) ? companyId : undefined,
  };
}
