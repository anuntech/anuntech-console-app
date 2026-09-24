import "server-only";
import { and, desc, eq, ilike, lte } from "drizzle-orm";
import { companies, invoices, subscriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { saoPauloDate } from "@/lib/dates";
import { issueDate } from "@/lib/recurrence";

/** Read-only diagnosis of what the recurring cron would pick up today. Remove after use. */
export async function GET(request: Request) {
  const today = saoPauloDate();
  const q = new URL(request.url).searchParams.get("q");
  if (q) {
    // One company's recurrences and their latest invoices.
    const subs = await db
      .select({
        id: subscriptions.id,
        company: companies.name,
        description: subscriptions.description,
        status: subscriptions.status,
        nextDueDate: subscriptions.nextDueDate,
        leadDays: subscriptions.leadDays,
        lastError: subscriptions.lastError,
      })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(ilike(companies.name, `%${q}%`));
    const out = [];
    for (const sub of subs) {
      const latest = await db
        .select({
          id: invoices.id,
          dueDate: invoices.dueDate,
          status: invoices.status,
          bankStatus: invoices.bankStatus,
          providerId: invoices.providerId,
          amountCents: invoices.amountCents,
        })
        .from(invoices)
        .where(eq(invoices.subscriptionId, sub.id))
        .orderBy(desc(invoices.dueDate))
        .limit(3);
      out.push({ ...sub, invoices: latest.map((i) => ({ ...i, providerId: !!i.providerId })) });
    }
    return Response.json({ today, subscriptions: out });
  }
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 5);
  const limit = horizon.toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: subscriptions.id,
      company: companies.name,
      description: subscriptions.description,
      status: subscriptions.status,
      nextDueDate: subscriptions.nextDueDate,
      leadDays: subscriptions.leadDays,
      lastError: subscriptions.lastError,
      amountCents: subscriptions.amountCents,
    })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .where(lte(subscriptions.nextDueDate, limit))
    .orderBy(subscriptions.nextDueDate);
  const detailed = [];
  for (const row of rows) {
    const [invoice] = await db
      .select({
        id: invoices.id,
        status: invoices.status,
        bankStatus: invoices.bankStatus,
        providerId: invoices.providerId,
        requested: invoices.bankRequest,
      })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, row.id), eq(invoices.dueDate, row.nextDueDate)));
    detailed.push({
      ...row,
      issueDate: issueDate(row.nextDueDate, row.leadDays),
      dueForIssue: row.status === "active" && issueDate(row.nextDueDate, row.leadDays) <= today,
      periodInvoice: invoice
        ? { id: invoice.id, status: invoice.status, bankStatus: invoice.bankStatus, providerId: !!invoice.providerId, requested: !!invoice.requested }
        : null,
    });
  }
  return Response.json({ today, horizon: limit, candidates: detailed });
}
