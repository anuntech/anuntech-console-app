import "server-only";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { companies, invoices, subscriptions } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Read-only: draft invoices whose due date differs from their recurrence's
 * next due date. The cron only issues the draft that matches, so these
 * would wait forever. Remove after use.
 */
export async function GET() {
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      company: companies.name,
      description: subscriptions.description,
      status: subscriptions.status,
      nextDueDate: subscriptions.nextDueDate,
      leadDays: subscriptions.leadDays,
      invoiceId: invoices.id,
      invoiceDueDate: invoices.dueDate,
      invoiceStatus: invoices.status,
    })
    .from(invoices)
    .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .where(
      and(
        eq(invoices.status, "draft"),
        inArray(subscriptions.status, ["draft", "active", "paused"]),
        ne(invoices.dueDate, subscriptions.nextDueDate),
      ),
    )
    .orderBy(asc(invoices.dueDate));
  const all = await db
    .select({ status: subscriptions.status, nextDueDate: subscriptions.nextDueDate })
    .from(subscriptions)
    .orderBy(asc(subscriptions.nextDueDate));
  const byStatus: Record<string, number> = {};
  for (const s of all) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  return Response.json({ mismatched: rows, subscriptionsByStatus: byStatus, nextDueDates: all.map((s) => `${s.status}:${s.nextDueDate}`) });
}
