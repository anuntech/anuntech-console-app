import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, engagements, invoices } from "@/db/schema";
import { canAccess, type Actor } from "../access/access";

/**
 * One invoice with its company and product, or null when it does not exist
 * or is out of reach (both answer "not found"): the finance area of its
 * company, and for clients only issued or paid invoices, never drafts.
 * Used by /financeiro/[id] and the app's finance.get.
 */
export async function findInvoice(actor: Actor, id: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      company: companies,
      engagement: engagements.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .leftJoin(engagements, eq(engagements.id, invoices.engagementId))
    .where(eq(invoices.id, id));
  if (
    !row ||
    !canAccess(actor, row.invoice.companyId, "finance") ||
    (!actor.admin && !["issued", "paid"].includes(row.invoice.status))
  )
    return null;
  return row;
}
