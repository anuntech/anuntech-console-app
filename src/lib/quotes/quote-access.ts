import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, quotes } from "@/db/schema";
import { canAccess, type Actor } from "../access/access";

/**
 * One quote with its company, or null when it does not exist or is out of
 * reach (both answer "not found"): the finance area of its company and, for
 * clients, never a draft or a cancellation. Used by /orcamentos/[id] and the
 * app's quotes.get.
 */
export async function findQuote(actor: Actor, id: string) {
  const [row] = await db
    .select({ quote: quotes, company: companies })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    .where(eq(quotes.id, id));
  if (!row || !canAccess(actor, row.quote.companyId, "finance")) return null;
  if (!actor.admin && (row.quote.status === "draft" || row.quote.status === "cancelled")) return null;
  return row;
}
