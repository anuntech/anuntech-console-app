import "server-only";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { companies, contractTemplates, contracts, engagements, quotes } from "@/db/schema";
import { saoPauloDate } from "@/lib/dates";
import { addDays } from "@/lib/billing/recurrence";
import { quoteNumberLabel } from "@/lib/quotes/quote-model";
import { accessibleCompanies, requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import type { NewContractData } from "./contract-sheet";

export type NewContractSearchParams = Promise<{
  companyId?: string;
  engagementId?: string;
  parentId?: string;
  /** An accepted proposal the contract formalizes. */
  orcamento?: string;
  /** With parentId: an amendment that extends the term, dates already set. */
  prorrogar?: string;
}>;
const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Companies, active templates and each company's items, for the creation
 * form. With a valid `parentId`, the form creates an amendment instead.
 */
export async function newContractContext(searchParams: NewContractSearchParams): Promise<NewContractData> {
  const actor = await requireAdmin();
  const allCompanies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
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
  const quoteRow =
    !parentRow && params.orcamento && UUID.test(params.orcamento)
      ? (
          await db
            .select({ quote: quotes, company: companies.name })
            .from(quotes)
            .innerJoin(companies, eq(companies.id, quotes.companyId))
            .where(and(eq(quotes.id, params.orcamento), eq(quotes.status, "accepted")))
        )[0]
      : null;
  const quote = quoteRow && allCompanies.some((c) => c.id === quoteRow.quote.companyId) ? quoteRow.quote : null;
  const [templates, items, amendments, [quoteProject]] = await Promise.all([
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
    quote
      ? db
          .select({ id: engagements.id })
          .from(engagements)
          .where(and(eq(engagements.quoteId, quote.id), eq(engagements.companyId, quote.companyId)))
          .orderBy(desc(engagements.createdAt))
          .limit(1)
      : Promise.resolve([]),
  ]);
  // Extending a contract: the day after it ends, for as long as it ran (a year when it had no start).
  const parentEnds = parentRow?.contract.endsAt;
  const renewal =
    parentRow && params.prorrogar && parentEnds
      ? (() => {
          const startsAt = addDays(parentEnds, 1);
          const length = parentRow.contract.startsAt ? Math.max(days(parentRow.contract.startsAt, parentEnds), 27) : 364;
          return { startsAt, endsAt: addDays(startsAt, length) };
        })()
      : parentRow && params.prorrogar
        ? { startsAt: saoPauloDate(), endsAt: addDays(saoPauloDate(), 364) }
        : undefined;
  return {
    companies: allCompanies,
    templates,
    engagements: items,
    companyId: quote?.companyId ?? (allCompanies.some((c) => c.id === params.companyId) ? params.companyId : undefined),
    engagementId: quoteProject?.id ?? (items.some((e) => e.id === params.engagementId) ? params.engagementId : undefined),
    quote: quote
      ? {
          id: quote.id,
          label: `Orçamento ${quoteNumberLabel(quote.year, quote.seq)} · ${quote.publication?.title ?? quote.title}`,
          company: quoteRow!.company,
          companyId: quote.companyId,
        }
      : undefined,
    // A software proposal usually becomes the development contract.
    templateId: quote ? templates.find((t) => /desenvolvimento/i.test(t.name))?.id : undefined,
    renewal,
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
