import "server-only";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { pool } from "@/lib/db";
import { auditEvents, companies, invoices, subscriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { saoPauloDate } from "@/lib/dates";
import { issueDate } from "@/lib/recurrence";

/** Read-only diagnosis of what the recurring cron would pick up today. Remove after use. */
export async function GET() {
  const today = saoPauloDate();
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 7);
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
      engagementId: subscriptions.engagementId,
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
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, row.id), eq(invoices.dueDate, row.nextDueDate)));
    const events = invoice
      ? await db
          .select({ action: auditEvents.action, createdAt: auditEvents.createdAt, details: auditEvents.details })
          .from(auditEvents)
          .where(eq(auditEvents.entityId, invoice.id))
          .orderBy(desc(auditEvents.createdAt))
          .limit(8)
      : [];
    detailed.push({
      ...row,
      issueDate: issueDate(row.nextDueDate, row.leadDays),
      dueForIssue: row.status === "active" && issueDate(row.nextDueDate, row.leadDays) <= today,
      periodInvoice: invoice
        ? {
            id: invoice.id,
            status: invoice.status,
            bankStatus: invoice.bankStatus,
            providerId: !!invoice.providerId,
            requested: !!invoice.requested,
            createdAt: invoice.createdAt,
          }
        : null,
      events,
    });
  }
  // Exactly what processSubscriptions selects, without issuing anything.
  const cronSelection = await db
    .select({ id: subscriptions.id, description: subscriptions.description, nextDueDate: subscriptions.nextDueDate })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(sql`(${subscriptions.nextDueDate} - ${subscriptions.leadDays})`, today),
      ),
    )
    .orderBy(asc(subscriptions.nextDueDate))
    .limit(20);
  // Is the cron's advisory lock free right now? (xact lock: released at rollback)
  const conn = await pool.connect();
  let lockFree: boolean | string;
  try {
    await conn.query("BEGIN");
    lockFree = (await conn.query("select pg_try_advisory_xact_lock(72649184) as locked")).rows[0].locked;
  } catch (e) {
    lockFree = e instanceof Error ? e.message : "erro";
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
  const holders = await db.execute(
    sql`select pid, state, now() - xact_start as xact_age, left(query, 120) as query from pg_stat_activity where pid in (select pid from pg_locks where locktype = 'advisory' and objid = 72649184)`,
  );
  return Response.json({ today, horizon: limit, lockFree, lockHolders: holders.rows, cronSelection, candidates: detailed });
}
