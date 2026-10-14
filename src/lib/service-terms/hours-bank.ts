import "server-only";
import { scopeIncludes, type EngagementScope } from "../access/engagement-scope";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { automationEvents, hoursMonths, serviceTerms, timeEntries, tickets, user } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { loadCalendar, snapshotOf } from "./terms";
import { BUSINESS_DAY_MINUTES, type TermsSnapshot } from "./terms-model";
import { visibleToClient } from "./ticket-clock";
import { addBusinessMinutes } from "./business-calendar";

type Executor = Pick<typeof db, "select">;

/** "2026-10" for an instant or a São Paulo date. */
export const monthOf = (date: string = saoPauloDate()) => date.slice(0, 7);
export const previousMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** Who looks: a client sees the bank only once its conditions are published; the team sees it a week earlier. */
export type BankAudience = {
  client?: boolean;
  now?: Date;
  /** A Membro with a selection: the lines about other products and projects stay out (the totals do not change). */
  engagements?: EngagementScope;
};

/** The company's conditions that hold an hours bank (SUP 3.1), if any. */
export async function bankTerms(companyId: string, audience: BankAudience = {}, executor: Executor = db): Promise<TermsSnapshot | null> {
  const rows = await executor
    .select()
    .from(serviceTerms)
    .where(and(eq(serviceTerms.companyId, companyId), eq(serviceTerms.active, true)))
    .orderBy(desc(serviceTerms.updatedAt));
  for (const row of rows) {
    const snapshot = snapshotOf(row);
    if (!row.verifiedAt || !snapshot?.policy.hoursBank?.monthlyMinutes) continue;
    if (audience.client && !visibleToClient(snapshot, audience.now ?? new Date())) continue;
    return snapshot;
  }
  return null;
}

export type BankMonth = {
  month: string;
  includedMinutes: number;
  /** Minutes that count against the bank (critical fixes count too; warranty fixes do not). */
  usedMinutes: number;
  overageApprovedMinutes: number;
  alertPercent: number;
  entries: {
    id: string;
    minutes: number;
    note: string;
    workedOn: string;
    kind: string;
    ticketId: string | null;
    ticket: string | null;
    author: string;
    /** The product or project the hours were about (the entry's, else its ticket's). */
    engagementId: string | null;
  }[];
  reportSentAt: string | null;
  contestedAt: string | null;
  contestNote: string | null;
  reportContestDays: number | null;
  /** Last instant the client may contest the sent report (SUP 3.4); null when the contract sets no window. */
  contestUntil: string | null;
  terms: TermsSnapshot;
};

/** One month of a company's bank: what is included, what was used, what was approved beyond it. */
export async function bankMonth(companyId: string, month = monthOf(), audience: BankAudience = {}, executor: Executor = db): Promise<BankMonth | null> {
  const terms = await bankTerms(companyId, audience, executor);
  const bank = terms?.policy.hoursBank;
  if (!terms || !bank) return null;
  const [entries, [record]] = await Promise.all([
    executor
      .select({
        id: timeEntries.id,
        minutes: timeEntries.minutes,
        note: timeEntries.note,
        workedOn: timeEntries.workedOn,
        kind: timeEntries.kind,
        ticketId: timeEntries.ticketId,
        ticket: tickets.subject,
        author: user.name,
        engagementId: sql<string | null>`coalesce(${timeEntries.engagementId}, ${tickets.engagementId})`,
      })
      .from(timeEntries)
      .innerJoin(user, eq(user.id, timeEntries.authorId))
      .leftJoin(tickets, eq(tickets.id, timeEntries.ticketId))
      .where(and(eq(timeEntries.companyId, companyId), gte(timeEntries.workedOn, `${month}-01`), lt(timeEntries.workedOn, `${nextMonth(month)}-01`)))
      .orderBy(desc(timeEntries.workedOn), desc(timeEntries.createdAt)),
    executor.select().from(hoursMonths).where(and(eq(hoursMonths.companyId, companyId), eq(hoursMonths.month, month))),
  ]);
  const contestDays = terms.personClient ? null : (bank.reportContestDays ?? null);
  const contestUntil =
    record?.reportSentAt && contestDays
      ? addBusinessMinutes(record.reportSentAt, contestDays * BUSINESS_DAY_MINUTES, await loadCalendar(executor)).toISOString()
      : null;
  return {
    month,
    includedMinutes: bank.monthlyMinutes,
    usedMinutes: entries.filter((e) => e.kind !== "warranty").reduce((sum, e) => sum + e.minutes, 0),
    overageApprovedMinutes: record?.overageApprovedMinutes ?? 0,
    alertPercent: bank.alertPercent,
    entries,
    reportSentAt: record?.reportSentAt?.toISOString() ?? null,
    contestedAt: record?.contestedAt?.toISOString() ?? null,
    contestNote: record?.contestNote ?? null,
    reportContestDays: contestDays,
    contestUntil,
    terms,
  };
}

/** When the month's last hour was logged, so a report sent before it does not count as final. */
export async function lastLoggedAt(companyId: string, month: string) {
  const [row] = await db
    .select({ at: sql<Date | null>`max(${timeEntries.createdAt})` })
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, companyId), sql`${timeEntries.workedOn} >= ${`${month}-01`}::date and ${timeEntries.workedOn} < ${`${nextMonth(month)}-01`}::date`));
  return row?.at ? new Date(row.at) : null;
}

/** A report that covers the whole month: sent after it closed and after its last hour was logged. */
export function finalReport(reportSentAt: string | null, month: string, lastLogged: Date | null) {
  if (!reportSentAt) return false;
  const sent = new Date(reportSentAt);
  return sent >= new Date(`${nextMonth(month)}-01T00:00:00-03:00`) && (!lastLogged || sent >= lastLogged);
}

/** What a bank card shows: never the terms themselves, only the month's numbers. */
export type BankCard = Omit<BankMonth, "terms" | "entries"> & {
  companyId: string;
  companyName: string;
  entries: Omit<BankMonth["entries"][number], "ticketId" | "engagementId">[];
  /** When this month's 80% alert went out (once a month; see hours-delivery.ts). */
  alertSentAt: string | null;
  /** Last month, while its report waits to be sent (team) or can still be contested (client). */
  previous: (Pick<BankMonth, "month" | "usedMinutes" | "includedMinutes" | "overageApprovedMinutes" | "reportSentAt" | "contestedAt" | "contestUntil"> & {
    /** The report covers the whole month (sent after it closed and after its last hour). */
    final: boolean;
  }) | null;
};

/** This month's card for a company, plus last month while its report is pending or contestable. */
export async function bankCard(companyId: string, companyName: string, audience: BankAudience = {}): Promise<BankCard | null> {
  const now = audience.now ?? new Date();
  const current = await bankMonth(companyId, monthOf(), audience);
  if (!current) return null;
  const last = await bankMonth(companyId, previousMonth(current.month), audience);
  const lastFinal = !!last && finalReport(last.reportSentAt, last.month, await lastLoggedAt(companyId, last.month));
  const lastOpen = !!last && (audience.client
    ? !!last.reportSentAt && !last.contestedAt && (!last.contestUntil || new Date(last.contestUntil) >= now)
    : (!lastFinal && last.entries.length > 0) || (!!last.reportSentAt && !last.contestedAt && !!last.contestUntil && new Date(last.contestUntil) >= now));
  const [alert] = await db
    .select({ at: automationEvents.createdAt })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "hours.alert"), eq(automationEvents.entityId, `${companyId}:${current.month}`)));
  const { terms: _terms, entries, ...rest } = current;
  void _terms;
  return {
    ...rest,
    companyId,
    companyName,
    alertSentAt: alert?.at.toISOString() ?? null,
    entries: entries
      .filter((e) => !audience.engagements || !e.engagementId || scopeIncludes(audience.engagements, e.engagementId))
      .map(({ ticketId: _ticket, engagementId: _engagement, ...e }) => (void _ticket, void _engagement, e)),
    previous: lastOpen && last
      ? { month: last.month, usedMinutes: last.usedMinutes, includedMinutes: last.includedMinutes, overageApprovedMinutes: last.overageApprovedMinutes, reportSentAt: last.reportSentAt, contestedAt: last.contestedAt, contestUntil: last.contestUntil, final: lastFinal }
      : null,
  };
}

/** Companies whose bank reached the alert line this month: for the team's attention list. */
export async function banksAtAlert(executor: Executor = db) {
  const month = monthOf();
  const rows = await executor
    .select({ companyId: timeEntries.companyId, used: sql<number>`sum(${timeEntries.minutes}) filter (where ${timeEntries.kind} <> 'warranty')::int` })
    .from(timeEntries)
    .where(gte(timeEntries.workedOn, `${month}-01`))
    .groupBy(timeEntries.companyId);
  const out: { companyId: string; percent: number }[] = [];
  for (const row of rows) {
    const terms = await bankTerms(row.companyId, {}, executor);
    const bank = terms?.policy.hoursBank;
    if (!bank?.monthlyMinutes) continue;
    const percent = Math.round(((row.used ?? 0) / bank.monthlyMinutes) * 100);
    if (percent >= bank.alertPercent) out.push({ companyId: row.companyId, percent });
  }
  return out;
}

export const hoursLabel = (minutes: number) => {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${String(hours).replace(".", ",")} ${hours === 1 ? "hora" : "horas"}`;
};
