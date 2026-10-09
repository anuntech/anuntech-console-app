import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { consoleStaffMembers, engagements, journeys, quotes, tickets, user } from "@/db/schema";
import { db } from "../db";
import { normalizeEmail } from "../access/permissions";

/* Read-only lists for the journey's staff screens (the pages check access first). */

/**
 * When a journey last moved: its own changes, or the proposal, contract and
 * board it follows (those change on their own screens). Columns spelled out:
 * in a one-table select Drizzle writes them without the table, and inside the
 * subqueries they would mean the subquery's own.
 */
export const journeyMovedAt = sql<Date>`greatest(
  console_journeys.updated_at,
  coalesce((select q.updated_at from console_quotes q where q.id = console_journeys.quote_id), console_journeys.updated_at),
  coalesce((select max(c.updated_at) from console_contracts c where c.quote_id = console_journeys.quote_id), console_journeys.updated_at),
  coalesce(
    (select max(t.updated_at) from console_tasks t
      where t.engagement_id = coalesce(console_journeys.engagement_id, (select e.id from console_engagements e where e.quote_id = console_journeys.quote_id limit 1))),
    console_journeys.updated_at
  )
)`;

/** Candidates for "Vincular": the company's proposals, projects, products and requests (staff screen). */
export async function journeyCandidates(companyId: string) {
  const [quoteRows, items, requests, linked] = await Promise.all([
    db
      .select({ id: quotes.id, title: quotes.title, status: quotes.status, year: quotes.year, seq: quotes.seq })
      .from(quotes)
      .where(and(eq(quotes.companyId, companyId), ne(quotes.status, "cancelled"))),
    db.select({ id: engagements.id, name: engagements.name, kind: engagements.kind }).from(engagements).where(eq(engagements.companyId, companyId)),
    db
      .select({ id: tickets.id, subject: tickets.subject })
      .from(tickets)
      .where(and(eq(tickets.companyId, companyId), eq(tickets.kind, "new_project"))),
    db.select({ quoteId: journeys.quoteId }).from(journeys).where(and(eq(journeys.companyId, companyId), sql`${journeys.quoteId} is not null`)),
  ]);
  const taken = new Set(linked.map((row) => row.quoteId));
  return {
    quotes: quoteRows.map((q) => ({ id: q.id, label: `${q.year}-${String(q.seq).padStart(3, "0")} · ${q.title}`, taken: taken.has(q.id) })),
    projects: items.filter((i) => i.kind === "project").map((i) => ({ id: i.id, label: i.name })),
    hosting: items.filter((i) => i.kind !== "project").map((i) => ({ id: i.id, label: i.name })),
    tickets: requests.map((t) => ({ id: t.id, label: t.subject })),
  };
}

/** The staff who can own a journey or a step. */
export async function journeyStaff() {
  const staff = await db.select({ email: consoleStaffMembers.email }).from(consoleStaffMembers).where(eq(consoleStaffMembers.active, true));
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  const emails = [...new Set([...staff.map((s) => s.email), ...(owner ? [normalizeEmail(owner)] : [])])];
  if (!emails.length) return [];
  const rows = await db.select({ id: user.id, name: user.name, email: user.email, image: user.image }).from(user).where(inArray(user.email, emails));
  return rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "pt-BR"));
}
