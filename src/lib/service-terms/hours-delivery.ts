import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { auditEvents, automationEvents, companies, hoursMonths, serviceTerms } from "@/db/schema";
import { db } from "../db";
import { dateLabel } from "../format";
import { companyAdministrators, sendClientMail } from "../notifications/client-mail";
import { automationActorId } from "../ops/automation-actor";
import { bankMonth, banksAtAlert, finalReport, hoursLabel, lastLoggedAt, monthOf, previousMonth } from "./hours-bank";

/*
 * The hours bank's two notices to the company's Administradores (SUP 3.3 and
 * 3.4): the 80% alert of the month and the month's report. The team sends
 * them by click; with the automation switched on, the routines send them too.
 * Either way the alert goes once per company and month (an automation event
 * claims it before sending) and every e-mail carries a fixed key.
 */

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";
const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

type Who = { actorId: string | null; automatic?: boolean };

/** When this month's alert went out, per company. */
export async function alertsSent(companyIds: string[], month = monthOf()) {
  if (!companyIds.length) return new Map<string, Date>();
  const rows = await db
    .select({ entityId: automationEvents.entityId, at: automationEvents.createdAt })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "hours.alert"), inArray(automationEvents.entityId, companyIds.map((id) => `${id}:${month}`))));
  return new Map(rows.map((row) => [row.entityId.split(":")[0], row.at]));
}

/**
 * The month's alert, once. Automatic sends only read conditions the client
 * can already see. Null when the company has no bank; `already` when this
 * month's alert went out before.
 */
export async function deliverBankAlert(companyId: string, who: Who): Promise<{ sent: number; already?: Date } | null> {
  const data = await bankMonth(companyId, monthOf(), who.automatic ? { client: true } : {});
  if (!data) return null;
  const admins = await companyAdministrators(companyId);
  if (!admins.length) return { sent: 0 };
  const entityId = `${companyId}:${data.month}`;
  const percent = Math.round((data.usedMinutes / data.includedMinutes) * 100);
  const [claimed] = await db
    .insert(automationEvents)
    .values({ kind: "hours.alert", entityId, companyId, actorId: who.actorId, details: { percent, automatic: !!who.automatic } })
    .onConflictDoNothing()
    .returning({ id: automationEvents.id });
  if (!claimed) {
    const [previous] = await db
      .select({ at: automationEvents.createdAt })
      .from(automationEvents)
      .where(and(eq(automationEvents.kind, "hours.alert"), eq(automationEvents.entityId, entityId)));
    return { sent: 0, already: previous?.at ?? new Date() };
  }
  let sent = 0;
  for (const person of admins) {
    try {
      await sendClientMail({
        to: person.email,
        tag: "hours-alert",
        key: entityId,
        subject: `Banco de horas em ${percent}%`,
        text: `O banco de horas deste mês está em ${hoursLabel(data.usedMinutes)} de ${hoursLabel(data.includedMinutes)}.\n\nFora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da empresa. Se quiser que a equipe continue além dele, aprove as horas extras no Console: ${consoleUrl()}/painel\n\nAnuntech`,
      });
      sent += 1;
    } catch {
      /* The notice stays in the Console. */
    }
  }
  // Nobody got it: free the month so the team (or the next run) can try again.
  if (!sent) await db.delete(automationEvents).where(eq(automationEvents.id, claimed.id));
  // A routine that reached nobody tries again later; only a send or a click goes in the history.
  const actorId = who.actorId ?? (await automationActorId());
  if (actorId && (sent || !who.automatic))
    await db.insert(auditEvents).values({ actorId, companyId, entityId: companyId, action: "hours.alert_sent", details: { month: data.month, sent, automatic: !!who.automatic } });
  return { sent };
}

/**
 * The month's report to the Administradores; sending starts the client's
 * window to contest it (SUP 3.4). Automatic sends go once, for a month with
 * work logged and no report yet; the team may send a partial or repeated one.
 */
export async function deliverHoursReport(companyId: string, month: string, who: Who): Promise<{ sent: number; skipped?: string; failed?: boolean } | null> {
  const data = await bankMonth(companyId, month, who.automatic ? { client: true } : {});
  if (!data) return null;
  if (who.automatic) {
    if (data.reportSentAt) return { sent: 0, skipped: "sent" };
    if (!data.entries.length) return { sent: 0, skipped: "empty" };
    const [claimed] = await db
      .insert(automationEvents)
      .values({ kind: "hours.report", entityId: `${companyId}:${month}`, companyId, actorId: null, details: { automatic: true } })
      .onConflictDoNothing()
      .returning({ id: automationEvents.id });
    if (!claimed) return { sent: 0, skipped: "claimed" };
  }
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
  const lines = data.entries
    .map((e) => `- ${dateLabel(e.workedOn)} · ${hoursLabel(e.minutes)}${e.kind === "warranty" ? " (garantia, fora do banco)" : e.kind === "critical" ? " (defeito crítico)" : ""} · ${e.note}${e.ticket ? ` · ${e.ticket}` : ""}`)
    .join("\n");
  const contest = data.reportContestDays
    ? `\n\nVocê pode contestar este relatório no Console em até ${data.reportContestDays} dias úteis. Sem contestação, ele conta como aprovado.`
    : "";
  let sent = 0;
  const admins = await companyAdministrators(companyId);
  for (const person of admins) {
    try {
      await sendClientMail({
        to: person.email,
        tag: "hours-report",
        // A team member's repeat is a new e-mail on purpose; the routine's is not.
        key: who.automatic ? `${companyId}:${month}` : undefined,
        subject: `Banco de horas de ${monthName(month)}: ${company?.name ?? ""}`,
        text: `Relatório do banco de horas de ${monthName(month)}.\n\nUsado: ${hoursLabel(data.usedMinutes)} de ${hoursLabel(data.includedMinutes)} incluídas${data.overageApprovedMinutes ? `, com até ${hoursLabel(data.overageApprovedMinutes)} além do banco aprovadas` : ""}.\n\n${lines || "Nenhum registro no mês."}${contest}\n\nVeja no Console: ${consoleUrl()}/painel\n\nAnuntech`,
      });
      sent += 1;
    } catch {
      /* The report stays in the Console. */
    }
  }
  const actorId = who.actorId ?? (await automationActorId());
  const now = new Date();
  // Sending starts the client's window to contest: only a report that reached someone (or a company with nobody to receive it, by the team) counts.
  if (!sent && admins.length && !who.automatic) return { sent: 0, failed: true };
  if (sent || !who.automatic)
    await db
      .insert(hoursMonths)
      .values({ companyId, month, reportSentAt: now, reportSentBy: actorId })
      .onConflictDoUpdate({ target: [hoursMonths.companyId, hoursMonths.month], set: { reportSentAt: now, reportSentBy: actorId, updatedAt: now } });
  else await db.delete(automationEvents).where(and(eq(automationEvents.kind, "hours.report"), eq(automationEvents.entityId, `${companyId}:${month}`)));
  if (actorId)
    await db.insert(auditEvents).values({ actorId, companyId, entityId: companyId, action: "hours.report_sent", details: { month, sent, automatic: !!who.automatic } });
  return { sent };
}

/** The closed months the lists look back on. */
const CLOSED_MONTHS = 3;
const closedMonths = () => {
  const out: string[] = [];
  let month = monthOf();
  for (let i = 0; i < CLOSED_MONTHS; i++) out.push((month = previousMonth(month)));
  return out;
};

/** Companies with a confirmed hours bank. */
async function bankCompanies() {
  const rows = await db
    .selectDistinct({ companyId: serviceTerms.companyId, name: companies.name })
    .from(serviceTerms)
    .innerJoin(companies, eq(companies.id, serviceTerms.companyId))
    .where(
      and(
        eq(serviceTerms.active, true),
        isNotNull(serviceTerms.verifiedAt),
        eq(companies.archived, false),
        sql`coalesce((${serviceTerms.policy}->'hoursBank'->>'monthlyMinutes')::int, 0) > 0`,
      ),
    );
  return rows;
}

/** What the team still owes the client this month: the 80% alert not sent, last month's report not sent. */
export async function hoursPending() {
  const month = monthOf();
  const [atAlert, banks] = await Promise.all([banksAtAlert(), bankCompanies()]);
  const sent = await alertsSent(atAlert.map((b) => b.companyId), month);
  const names = new Map(banks.map((b) => [b.companyId, b.name]));
  const reports: { companyId: string; company: string; month: string; again: boolean }[] = [];
  for (const bank of banks)
    for (const closed of closedMonths()) {
      const data = await bankMonth(bank.companyId, closed);
      if (!data || !data.entries.length || finalReport(data.reportSentAt, closed, await lastLoggedAt(bank.companyId, closed))) continue;
      reports.push({ companyId: bank.companyId, company: bank.name, month: closed, again: !!data.reportSentAt });
    }
  return {
    alerts: atAlert
      .filter((b) => !sent.has(b.companyId))
      .map((b) => ({ companyId: b.companyId, company: names.get(b.companyId) ?? "", percent: b.percent })),
    reports,
  };
}

/**
 * The hours beyond the bank in a closed month, ready to bill once the
 * report was sent and the client's window to contest it ended without a
 * contest (SUP 3.3 and 3.4). Null when there is nothing to bill.
 */
export async function overageCharge(companyId: string, month: string, now = new Date()) {
  const data = await bankMonth(companyId, month);
  const price = data?.terms.policy.hoursBank?.overageCents;
  if (!data || !price || month >= monthOf()) return null;
  const minutes = data.usedMinutes - data.includedMinutes;
  if (minutes <= 0 || !data.reportSentAt || data.contestedAt) return null;
  // Only hours the client saw in a final report, after the window to contest it.
  if (!finalReport(data.reportSentAt, month, await lastLoggedAt(companyId, month))) return null;
  if (data.contestUntil && new Date(data.contestUntil) > now) return null;
  return {
    minutes,
    priceCents: price,
    amountCents: Math.round((minutes / 60) * price),
    description: `Horas além do banco de ${monthName(month)} (${hoursLabel(minutes)})`,
  };
}

/** Closed months whose overage is ready to bill and was not prepared yet, for the team's lists. */
export async function overagesToBill(now = new Date()) {
  const out: { companyId: string; company: string; month: string; amountCents: number; minutes: number }[] = [];
  for (const bank of await bankCompanies())
    for (const month of closedMonths()) {
      const charge = await overageCharge(bank.companyId, month, now);
      if (!charge) continue;
      const [prepared] = await db
        .select({ id: automationEvents.id })
        .from(automationEvents)
        .where(and(eq(automationEvents.kind, "hours.overage_billed"), eq(automationEvents.entityId, `${bank.companyId}:${month}`)));
      if (!prepared) out.push({ companyId: bank.companyId, company: bank.name, month, amountCents: charge.amountCents, minutes: charge.minutes });
    }
  return out;
}

/** The first of the closed months whose overage is ready and not prepared, for one company's card. */
export async function overageReady(companyId: string, now = new Date()) {
  for (const month of closedMonths()) {
    const charge = await overageCharge(companyId, month, now);
    if (!charge) continue;
    const [prepared] = await db
      .select({ id: automationEvents.id })
      .from(automationEvents)
      .where(and(eq(automationEvents.kind, "hours.overage_billed"), eq(automationEvents.entityId, `${companyId}:${month}`)));
    if (!prepared) return { ...charge, month };
  }
  return null;
}
