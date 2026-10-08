import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { auditEvents, automationEvents, companies, consoleStaffMembers, serviceTerms, tickets, timeEntries } from "@/db/schema";
import { db } from "../db";
import { normalizeEmail } from "../access/permissions";
import { dueLabel } from "../format";
import { sendStaffMail, staffEmails } from "../notifications/ops-alerts";
import { loadCalendar } from "../service-terms/terms";
import { addBusinessMinutes } from "../service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "../service-terms/terms-model";

/*
 * Tickets that wait on someone, for the team only: the first response about
 * to be late (an e-mail to whoever owns the ticket), requests waiting on the
 * client past the contract's days, estimates nobody answered, and finished
 * tickets of hours-bank clients with no hours logged. Nothing here reaches
 * the client.
 */

export const TICKET_WATCH = {
  /** The reminder goes this long before the first response is due. */
  responseSoonMinutes: 60,
  /** Waiting on the client with no days in the conditions. */
  defaultClientDays: 5,
  /** An estimate the client has not answered. */
  estimateDays: 5,
  /** Finished tickets looked back on for missing hours. */
  hoursLookbackDays: 7,
} as const;

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

/** Whoever owns the ticket, when still on the team; otherwise the whole team. */
async function ownerOrTeam(assignedTo: string | null) {
  const team = await staffEmails();
  if (assignedTo) {
    const email = normalizeEmail(assignedTo);
    if (team.includes(email)) return [email];
  }
  return team;
}

/**
 * Called by the 5-minute routine: one e-mail when a first response is
 * about to be due and one when it is late, each once per deadline (a new
 * priority moves the deadline and earns a new reminder).
 */
export async function remindFirstResponses(now = new Date()) {
  const soon = new Date(now.getTime() + TICKET_WATCH.responseSoonMinutes * 60_000);
  const rows = await db
    .select({ id: tickets.id, subject: tickets.subject, dueAt: tickets.responseDueAt, assignedTo: tickets.assignedTo, company: companies.name })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    // Late for more than a day: already reminded, or older than this routine; they stay in the digest, not here.
    .where(
      and(
        isNull(tickets.firstResponseAt),
        inArray(tickets.status, ["open", "in_progress"]),
        isNotNull(tickets.responseDueAt),
        lte(tickets.responseDueAt, soon),
        gte(tickets.responseDueAt, new Date(now.getTime() - 86_400_000)),
      ),
    )
    .orderBy(asc(tickets.responseDueAt))
    .limit(30);
  let sent = 0;
  for (const row of rows) {
    const late = row.dueAt! <= now;
    const [claimed] = await db
      .insert(automationEvents)
      .values({ kind: late ? "ticket.response_late" : "ticket.response_soon", entityId: `${row.id}:${row.dueAt!.toISOString()}` })
      .onConflictDoNothing()
      .returning({ id: automationEvents.id });
    if (!claimed) continue;
    const to = await ownerOrTeam(row.assignedTo);
    const delivered = await sendStaffMail(
      to,
      `[Console] ${late ? "Primeira resposta atrasada" : "Primeira resposta vence em breve"}: ${row.company} · ${row.subject}`,
      `${late ? `A primeira resposta de "${row.subject}" (${row.company}) venceu ${dueLabel(row.dueAt!.toISOString())}.` : `A primeira resposta de "${row.subject}" (${row.company}) vence ${dueLabel(row.dueAt!.toISOString())}.`}\n\nSó uma resposta escrita no chamado conta para o contrato. Se já falou com o cliente por WhatsApp, registre a resposta no Console: ${consoleUrl()}/chamados/${row.id}\n\nConsole da Anuntech`,
    );
    // Nobody got it: the next run tries again.
    if (!delivered) {
      await db.delete(automationEvents).where(eq(automationEvents.id, claimed.id));
      continue;
    }
    sent += 1;
  }
  return { reminded: sent };
}

export type WatchItem = { line: string; href: string };

/** Lists for the morning digest and the team's overview. */
export async function ticketWatch(now = new Date()) {
  const calendar = await loadCalendar();
  const [waiting, estimates, finished] = await Promise.all([
    db
      .select({ id: tickets.id, subject: tickets.subject, company: companies.name, since: tickets.waitingSince, terms: tickets.terms, waitingFor: tickets.waitingFor })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(and(eq(tickets.status, "waiting_customer"), isNotNull(tickets.waitingSince)))
      .orderBy(asc(tickets.waitingSince)),
    db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        company: companies.name,
        proposedAt: sql<Date>`(select max(${auditEvents.createdAt}) from ${auditEvents} where ${auditEvents.entityId} = ${tickets.id} and ${auditEvents.action} = 'ticket.estimate_proposed')`,
      })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(and(eq(tickets.estimateStatus, "proposed"), inArray(tickets.status, ["open", "in_progress", "waiting_customer"]))),
    // Finished lately, at a company with a confirmed hours bank, with no hours and nobody saying there were none.
    db
      .select({ id: tickets.id, subject: tickets.subject, company: companies.name })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(
        and(
          inArray(tickets.status, ["resolved", "closed"]),
          gte(tickets.updatedAt, new Date(now.getTime() - TICKET_WATCH.hoursLookbackDays * 86_400_000)),
          sql`exists (select 1 from ${serviceTerms} t where t.company_id = ${tickets.companyId} and t.active and t.verified_at is not null and coalesce((t.policy->'hoursBank'->>'monthlyMinutes')::int, 0) > 0)`,
          sql`not exists (select 1 from ${timeEntries} e where e.ticket_id = ${tickets.id})`,
          sql`not exists (select 1 from ${automationEvents} a where a.kind = 'ticket.no_hours' and a.entity_id = ${tickets.id})`,
        ),
      )
      .orderBy(desc(tickets.updatedAt)),
  ]);
  const waitingLong = waiting.filter((t) => {
    const days = t.terms?.policy.clientResponseDays ?? TICKET_WATCH.defaultClientDays;
    return addBusinessMinutes(t.since!, days * BUSINESS_DAY_MINUTES, calendar) < now;
  });
  const estimateLimit = now.getTime() - TICKET_WATCH.estimateDays * 86_400_000;
  return {
    waiting: waitingLong.map((t) => {
      const missing = t.waitingFor?.replace(/\s+/g, " ").trim();
      return { line: `${t.company} · ${t.subject}${missing ? ` · falta: ${missing.length > 80 ? `${missing.slice(0, 79)}…` : missing}` : ""}`, href: `/chamados/${t.id}` };
    }),
    estimates: estimates
      .filter((t) => t.proposedAt && new Date(t.proposedAt).getTime() < estimateLimit)
      .map((t) => ({ line: `${t.company} · ${t.subject}`, href: `/chamados/${t.id}` })),
    noHours: finished.map((t) => ({ line: `${t.company} · ${t.subject}`, href: `/chamados/${t.id}` })),
  };
}

/** The staff member who took the company's (or the item's) last ticket, still on the team: who gets a new one. */
export async function usualAssignee(companyId: string, engagementId: string | null, executor: Pick<typeof db, "select"> = db) {
  const recent = await executor
    .select({ assignedTo: tickets.assignedTo, engagementId: tickets.engagementId })
    .from(tickets)
    .where(and(eq(tickets.companyId, companyId), isNotNull(tickets.assignedTo)))
    .orderBy(desc(tickets.createdAt))
    .limit(20);
  const ordered = engagementId ? [...recent.filter((t) => t.engagementId === engagementId), ...recent] : recent;
  for (const row of ordered) {
    const email = normalizeEmail(row.assignedTo!);
    const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
    if (owner && normalizeEmail(owner) === email) return email;
    const [staff] = await executor
      .select({ id: consoleStaffMembers.id })
      .from(consoleStaffMembers)
      .where(and(eq(consoleStaffMembers.email, email), eq(consoleStaffMembers.active, true)));
    if (staff) return email;
  }
  return null;
}
