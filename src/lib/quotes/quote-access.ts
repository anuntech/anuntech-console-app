import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { companies, quoteVersions, quotes } from "@/db/schema";
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

/** Every proposal sent so far, newest first; `current` is the one the client answers (web /orcamentos/[id] and the app). */
export async function quoteVersionList(q: { id: string; status: string; documentHash: string | null }) {
  const rows = await db
    .select({ version: quoteVersions.version, sentAt: quoteVersions.sentAt, hash: quoteVersions.documentHash })
    .from(quoteVersions)
    .where(eq(quoteVersions.quoteId, q.id))
    .orderBy(desc(quoteVersions.version));
  return rows.map((v) => ({
    version: v.version,
    sentAt: v.sentAt.toISOString(),
    hash: v.hash,
    current: q.status !== "draft" && v.hash === q.documentHash,
  }));
}
