import "server-only";
import { and, count, inArray, isNotNull } from "drizzle-orm";
import { contracts, engagements, invoices, quotes, subscriptions } from "@/db/schema";
import { db } from "./db";
import type { CompanyLinks, EngagementLinks } from "./deletion-rules";

/** The database or an open transaction: the delete actions count inside theirs. */
type Reader = Pick<typeof db, "select">;

const tally = (rows: { id: string | null; n: number }[]) =>
  new Map(rows.map((row) => [row.id, row.n]));

/**
 * What points at each project, product or service, for `canDeleteEngagement`.
 * Pages pass only the rows they show; ids with nothing linked come back as zeros.
 */
export async function engagementLinks(ids: string[], reader: Reader = db) {
  const links = new Map<string, EngagementLinks>();
  if (!ids.length) return links;
  const [billed, recurring, signed, owning] = await Promise.all([
    reader
      .select({ id: invoices.engagementId, n: count() })
      .from(invoices)
      .where(inArray(invoices.engagementId, ids))
      .groupBy(invoices.engagementId),
    reader
      .select({ id: subscriptions.engagementId, n: count() })
      .from(subscriptions)
      .where(inArray(subscriptions.engagementId, ids))
      .groupBy(subscriptions.engagementId),
    reader
      .select({ id: contracts.engagementId, n: count() })
      .from(contracts)
      .where(inArray(contracts.engagementId, ids))
      .groupBy(contracts.engagementId),
    // A catalog item points at its recurrence from the engagement side.
    reader
      .select({ id: engagements.id })
      .from(engagements)
      .where(and(inArray(engagements.id, ids), isNotNull(engagements.subscriptionId))),
  ]);
  const [byInvoice, bySubscription, byContract] = [billed, recurring, signed].map(tally);
  const pointing = new Set(owning.map((row) => row.id));
  for (const id of ids)
    links.set(id, {
      invoices: byInvoice.get(id) ?? 0,
      subscriptions: (bySubscription.get(id) ?? 0) + (pointing.has(id) ? 1 : 0),
      contracts: byContract.get(id) ?? 0,
    });
  return links;
}

/** What points at each company, for `canDeleteCompany`. */
export async function companyLinks(ids: string[], reader: Reader = db) {
  const links = new Map<string, CompanyLinks>();
  if (!ids.length) return links;
  const [billed, recurring, signed, proposed] = await Promise.all([
    reader
      .select({ id: invoices.companyId, n: count() })
      .from(invoices)
      .where(inArray(invoices.companyId, ids))
      .groupBy(invoices.companyId),
    reader
      .select({ id: subscriptions.companyId, n: count() })
      .from(subscriptions)
      .where(inArray(subscriptions.companyId, ids))
      .groupBy(subscriptions.companyId),
    reader
      .select({ id: contracts.companyId, n: count() })
      .from(contracts)
      .where(inArray(contracts.companyId, ids))
      .groupBy(contracts.companyId),
    reader
      .select({ id: quotes.companyId, n: count() })
      .from(quotes)
      .where(inArray(quotes.companyId, ids))
      .groupBy(quotes.companyId),
  ]);
  const [byInvoice, bySubscription, byContract, byQuote] = [billed, recurring, signed, proposed].map(tally);
  for (const id of ids)
    links.set(id, {
      invoices: byInvoice.get(id) ?? 0,
      subscriptions: bySubscription.get(id) ?? 0,
      contracts: byContract.get(id) ?? 0,
      quotes: byQuote.get(id) ?? 0,
    });
  return links;
}
