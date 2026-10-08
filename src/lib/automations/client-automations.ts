import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  auditEvents,
  automationEvents,
  companies,
  contractSignatures,
  contracts,
  engagements,
  invoices,
  quotes,
  tasks,
  tickets,
} from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { currency, dateLabel, dueLabel } from "../format";
import { addDays } from "../billing/recurrence";
import { companyAdministrators, sendClientMail } from "../notifications/client-mail";
import { automationActorId } from "../ops/automation-actor";
import { bankMonth, banksAtAlert, hoursLabel, monthOf, previousMonth } from "../service-terms/hours-bank";
import { deliverBankAlert, deliverHoursReport } from "../service-terms/hours-delivery";
import { governingTerms, loadCalendar, snapshotOf } from "../service-terms/terms";
import { addBusinessMinutes, type Calendar } from "../service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "../service-terms/terms-model";
import { visibleToClient } from "../service-terms/ticket-clock";
import { enqueueTicketNotice, ticketOpener } from "../tickets/ticket-notifications";
import { quoteNumberLabel } from "../quotes/quote-model";
import { automations } from "./automations";
import type { AutomationKey } from "./automation-list";

/*
 * The notices the Console sends to clients on its own, each behind its
 * switch in Configurações → Automações. Every one claims an automation event
 * before sending (unique kind + entity), so a retry or a second run never
 * repeats it, and every e-mail carries a fixed idempotency key. They go to
 * the company's Administradores (the ticket reminder goes through the
 * ticket notices, which follow the company's preferences).
 */

const consoleUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "https://console.anuntech.com";

/** Claims a step once; false when it was done before. */
async function claim(kind: string, entityId: string, companyId: string | null, details?: Record<string, unknown>) {
  const [row] = await db
    .insert(automationEvents)
    .values({ kind, entityId, companyId, details: { automatic: true, ...details } })
    .onConflictDoNothing()
    .returning({ id: automationEvents.id });
  return !!row;
}

/** Frees a claim when nobody got the e-mail, so the next run tries again. */
const release = (kind: string, entityId: string) =>
  db.delete(automationEvents).where(and(eq(automationEvents.kind, kind), eq(automationEvents.entityId, entityId)));

/** One e-mail to each of the company's Administradores; returns how many were accepted. */
async function mailAdministrators(companyId: string, mail: { tag: string; key: string; subject: string; text: string }) {
  let sent = 0;
  for (const person of await companyAdministrators(companyId)) {
    try {
      await sendClientMail({ to: person.email, ...mail });
      sent += 1;
    } catch {
      /* The Console still shows it. */
    }
  }
  return sent;
}

async function audit(companyId: string, entityId: string, action: string, details: Record<string, unknown>) {
  const actorId = await automationActorId();
  if (actorId) await db.insert(auditEvents).values({ actorId, companyId, entityId, action, details: { ...details, automatic: true } });
}

/* ---------- contract signed by both sides ---------- */

/** The final PDF's link and the next steps, once per contract. Also called right after the second signature. */
export async function deliverContractSigned(contractId: string) {
  if (!(await automationsOn("contractSigned"))) return false;
  const [row] = await db
    .select({ contract: contracts, company: companies.name })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(and(eq(contracts.id, contractId), eq(contracts.status, "signed")));
  if (!row || !(await claim("contract.signed_notice", contractId, row.contract.companyId))) return false;
  const c = row.contract;
  const noun = c.kind === "amendment" ? "aditivo" : "contrato";
  const sent = await mailAdministrators(c.companyId, {
    tag: "contract-signed",
    key: contractId,
    subject: `${noun === "aditivo" ? "Aditivo" : "Contrato"} assinado: ${c.title}`,
    text: `O ${noun} "${c.title}" foi assinado pelas duas partes.\n\nO PDF final, com as assinaturas, fica no Console: ${consoleUrl()}/contratos/${c.id}\n\nPróximos passos:\n- As cobranças aparecem em Financeiro: ${consoleUrl()}/financeiro\n- Acessos, dúvidas e pedidos seguem por chamado: ${consoleUrl()}/chamados\n- Como trabalhamos mostra os prazos e o que ajuda a equipe: ${consoleUrl()}/como-trabalhamos\n\nAnuntech`,
  });
  if (!sent) await release("contract.signed_notice", contractId);
  else await audit(c.companyId, contractId, "contract.signed_notice_sent", { sent });
  return sent > 0;
}

async function automationsOn(key: AutomationKey) {
  return (await automations())[key];
}

/** Contracts closed in the last two days that still owe the notice (the action's own send failed or the switch was off then). */
async function contractsSigned() {
  const rows = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      and(
        eq(contracts.status, "signed"),
        gte(contracts.signedAt, sql`now() - interval '2 days'`),
        sql`not exists (select 1 from ${automationEvents} a where a.kind = 'contract.signed_notice' and a.entity_id = ${contracts.id})`,
      ),
    );
  let sent = 0;
  for (const row of rows) if (await deliverContractSigned(row.id)) sent += 1;
  return sent;
}

/* ---------- hours bank ---------- */

/** The 80% alert, as soon as a bank crosses the line, for conditions the client already sees. */
async function hoursAlerts() {
  let sent = 0;
  const archived = new Set((await db.select({ id: companies.id }).from(companies).where(eq(companies.archived, true))).map((c) => c.id));
  for (const bank of await banksAtAlert()) {
    if (archived.has(bank.companyId)) continue;
    const result = await deliverBankAlert(bank.companyId, { actorId: null, automatic: true });
    if (result?.sent) sent += 1;
  }
  return sent;
}

/** The 2nd business day of the month, in São Paulo. */
function secondBusinessDay(month: string, cal: Calendar) {
  let found = 0;
  for (let day = 1; day <= 10; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    if (cal.isBusinessDay(date) && ++found === 2) return date;
  }
  return `${month}-03`;
}

/** Last month's report, from the 2nd business day, to companies with work logged and no report yet. */
async function hoursReports(today: string, cal: Calendar) {
  if (today < secondBusinessDay(monthOf(today), cal)) return 0;
  const month = previousMonth(monthOf(today));
  // Companies with work logged that month; deliverHoursReport skips those without a bank the client sees.
  const companyIds = (await banksWithEntries(month)).map((row) => row.companyId);
  let sent = 0;
  for (const companyId of companyIds) {
    const result = await deliverHoursReport(companyId, month, { actorId: null, automatic: true });
    if (result?.sent) sent += 1;
  }
  return sent;
}

async function banksWithEntries(month: string) {
  const rows = await db.execute(
    sql`select distinct e.company_id from console_time_entries e join console_companies c on c.id = e.company_id where not c.archived and e.worked_on >= ${`${month}-01`}::date and e.worked_on < (${`${month}-01`}::date + interval '1 month')`,
  );
  return (rows.rows as { company_id: string }[]).map((row) => ({ companyId: row.company_id }));
}

/* ---------- proposals and contracts waiting on the client ---------- */

/** 3 days before a proposal's validity, once per version sent. */
async function quoteReminders(today: string) {
  const rows = await db
    .select({ quote: quotes, company: companies.name })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    // At least a day after the send, so the reminder never follows the proposal by minutes.
    .where(
      and(
        eq(quotes.status, "sent"),
        eq(companies.archived, false),
        gte(quotes.validUntil, today),
        lte(quotes.validUntil, addDays(today, 3)),
        lte(quotes.publishedAt, sql`now() - interval '1 day'`),
      ),
    );
  let sent = 0;
  for (const { quote: q } of rows) {
    const entity = `${q.id}:${q.publishedVersion}`;
    if (!(await claim("quote.reminder", entity, q.companyId))) continue;
    const number = quoteNumberLabel(q.year, q.seq);
    const delivered = await mailAdministrators(q.companyId, {
      tag: "quote-reminder",
      key: entity,
      subject: `Orçamento ${number} vale até ${dateLabel(q.validUntil!)}`,
      text: `O orçamento ${number}, ${q.publication?.title ?? q.title}, ainda espera resposta e vale até ${dateLabel(q.validUntil!)}.\n\nLeia e responda no Console: ${consoleUrl()}/orcamentos/${q.id}\n\nSe precisar de mais prazo ou de algum ajuste, responda por chamado.\n\nAnuntech`,
    });
    if (!delivered) await release("quote.reminder", entity);
    else {
      sent += 1;
      await audit(q.companyId, q.id, "quote.reminder_sent", { version: q.publishedVersion, sent: delivered });
    }
  }
  return sent;
}

/** 7 days after a contract went out without the client's signature, once per version. */
async function contractReminders() {
  const rows = await db
    .select({ contract: contracts })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(
      and(
        eq(contracts.status, "sent"),
        eq(companies.archived, false),
        // Sent 7 to 14 days ago: older ones were already chased by hand, not by a burst on the first run.
        lte(contracts.publishedAt, sql`now() - interval '7 days'`),
        gte(contracts.publishedAt, sql`now() - interval '14 days'`),
        sql`not exists (select 1 from ${contractSignatures} s where s.contract_id = ${contracts.id} and s.document_hash = ${contracts.documentHash} and s.party = 'client')`,
      ),
    );
  let sent = 0;
  for (const { contract: c } of rows) {
    const entity = `${c.id}:${c.publishedVersion}`;
    if (!(await claim("contract.reminder", entity, c.companyId))) continue;
    const delivered = await mailAdministrators(c.companyId, {
      tag: "contract-reminder",
      key: entity,
      subject: `${c.kind === "amendment" ? "Aditivo" : "Contrato"} esperando sua assinatura: ${c.title}`,
      text: `"${c.title}" foi enviado há mais de uma semana e ainda espera a assinatura da sua empresa.\n\nLeia e assine no Console, ou peça alterações cláusula por cláusula: ${consoleUrl()}/contratos/${c.id}\n\nAnuntech`,
    });
    if (!delivered) await release("contract.reminder", entity);
    else {
      sent += 1;
      await audit(c.companyId, c.id, "contract.reminder_sent", { version: c.publishedVersion, sent: delivered });
    }
  }
  return sent;
}

/* ---------- deliveries in Revisão ---------- */

/** Once a day, per company: what entered Revisão since the last notice, with the test window when the conditions have one. */
async function reviewNotices(now: Date, cal: Calendar) {
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, reviewSince: tasks.reviewSince, companyId: tasks.companyId, projectId: engagements.id, project: engagements.name })
    .from(tasks)
    .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
    .innerJoin(companies, eq(companies.id, tasks.companyId))
    .where(
      and(
        eq(tasks.status, "review"),
        isNotNull(tasks.reviewSince),
        // What entered Revisão in the last 3 days; older deliveries are the team's follow-up, not news.
        gte(tasks.reviewSince, sql`now() - interval '3 days'`),
        eq(companies.archived, false),
        sql`not exists (select 1 from ${automationEvents} a where a.kind = 'task.review_notice' and a.entity_id = ${tasks.id} || ':' || to_char(${tasks.reviewSince} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))`,
      ),
    )
    .orderBy(asc(tasks.reviewSince));
  const byCompany = new Map<string, typeof rows>();
  for (const row of rows) byCompany.set(row.companyId, [...(byCompany.get(row.companyId) ?? []), row]);
  let sent = 0;
  for (const [companyId, items] of byCompany) {
    const windows = new Map<string, number | null>();
    const lines: string[] = [];
    const claimed: string[] = [];
    for (const task of items) {
      const entity = `${task.id}:${task.reviewSince!.toISOString().slice(0, 19)}`;
      if (!(await claim("task.review_notice", entity, companyId))) continue;
      claimed.push(entity);
      if (!windows.has(task.projectId)) {
        const terms = snapshotOf(await governingTerms(companyId, task.projectId));
        windows.set(task.projectId, terms && !terms.personClient && visibleToClient(terms, now) ? (terms.policy.testDays ?? null) : null);
      }
      const days = windows.get(task.projectId);
      const until = days ? ` · teste até ${dueLabel(addBusinessMinutes(task.reviewSince!, days * BUSINESS_DAY_MINUTES, cal), now)}` : "";
      lines.push(`- ${task.project} · ${task.title}${until} · ${consoleUrl()}/projetos/${task.projectId}`);
    }
    if (!lines.length) continue;
    const delivered = await mailAdministrators(companyId, {
      tag: "review-notice",
      key: claimed.join(",").slice(0, 120),
      subject: lines.length === 1 ? "Uma entrega para revisar" : `${lines.length} entregas para revisar`,
      text: `${lines.length === 1 ? "Esta entrega está" : "Estas entregas estão"} em Revisão, esperando o seu teste:\n\n${lines.join("\n")}\n\nAprove ou aponte o que não funcionou em cada cartão, no Console.\n\nAnuntech`,
    });
    if (!delivered) for (const entity of claimed) await release("task.review_notice", entity);
    else sent += 1;
  }
  return sent;
}

/* ---------- tickets waiting on the client ---------- */

/** Halfway through the client's days (3 business days without conditions), the request goes again, once per wait. */
async function waitingReminders(now: Date, cal: Calendar) {
  const rows = await db
    .select({ ticket: tickets })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .where(and(eq(tickets.status, "waiting_customer"), isNotNull(tickets.waitingSince), eq(companies.archived, false)));
  const actorId = await automationActorId();
  if (!actorId) return 0;
  let sent = 0;
  for (const { ticket: t } of rows) {
    const days = t.terms?.policy.clientResponseDays ? Math.max(1, Math.floor(t.terms.policy.clientResponseDays / 2)) : 3;
    const halfway = addBusinessMinutes(t.waitingSince!, days * BUSINESS_DAY_MINUTES, cal);
    // Due, and not long past (5 days): a wait that started weeks ago is the team's follow-up, not a burst on the first run.
    if (halfway > now || halfway.getTime() < now.getTime() - 5 * 86_400_000) continue;
    const entity = `${t.id}:${t.waitingSince!.toISOString().slice(0, 19)}`;
    if (!(await claim("ticket.waiting_reminder", entity, t.companyId))) continue;
    // Not on top of a reminder the team sent by hand today; taking today's claim also keeps the button from repeating it.
    if (!(await claim("ticket.client_reminder", `${t.id}:${saoPauloDate(now)}`, t.companyId))) continue;
    const reached = await db
      .transaction(async (tx) => {
        const [event] = await tx
          .insert(auditEvents)
          .values({ actorId, companyId: t.companyId, action: "ticket.client_reminded", entityId: t.id, details: { automatic: true } })
          .returning({ id: auditEvents.id });
        // Whoever opened the ticket always hears it; the company's contacts follow their preferences.
        const opener = await ticketOpener(tx, t, "");
        const queued = await enqueueTicketNotice(tx, event.id, t, "Anuntech", "Lembrete: a equipe ainda precisa de você", opener, t.waitingFor ? `O que falta: ${t.waitingFor}` : null);
        if (!queued) throw new Error("nobody");
        return true;
      })
      .catch(() => false);
    if (reached) sent += 1;
  }
  return sent;
}

/* ---------- weekly summary ---------- */

/** Mondays: one summary per company with something that moved in the week; a quiet week sends nothing. */
async function weeklySummaries(today: string, now: Date) {
  if (new Date(`${today}T12:00:00Z`).getUTCDay() !== 1) return 0;
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const active = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(
      and(
        eq(companies.archived, false),
        sql`(exists (select 1 from ${tickets} t where t.company_id = ${companies.id} and t.updated_at >= ${since})
          or exists (select 1 from ${tasks} k where k.company_id = ${companies.id} and k.updated_at >= ${since}))`,
      ),
    );
  let sent = 0;
  for (const company of active) {
    // The Monday's date names the week.
    const entity = `${company.id}:${today}`;
    if (!(await claim("weekly.summary", entity, company.id))) continue;
    const [opened, resolved, waiting, review, [nextInvoice], bank] = await Promise.all([
      db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.companyId, company.id), gte(tickets.createdAt, since))),
      db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.companyId, company.id), inArray(tickets.status, ["resolved", "closed"]), gte(tickets.updatedAt, since))),
      db.select({ id: tickets.id, subject: tickets.subject, waitingFor: tickets.waitingFor }).from(tickets).where(and(eq(tickets.companyId, company.id), eq(tickets.status, "waiting_customer"))),
      db.select({ title: tasks.title }).from(tasks).where(and(eq(tasks.companyId, company.id), eq(tasks.status, "review"))),
      db
        .select({ description: invoices.description, amountCents: invoices.amountCents, dueDate: sql<string>`coalesce(${invoices.bankDueDate}, ${invoices.dueDate})::text` })
        .from(invoices)
        .where(and(eq(invoices.companyId, company.id), eq(invoices.status, "issued")))
        .orderBy(asc(sql`coalesce(${invoices.bankDueDate}, ${invoices.dueDate})`))
        .limit(1),
      bankMonth(company.id, monthOf(today), { client: true, now }),
    ]);
    const sections = [
      `Chamados na semana: ${opened.length} ${opened.length === 1 ? "aberto" : "abertos"}, ${resolved.length} ${resolved.length === 1 ? "resolvido" : "resolvidos"}.`,
      waiting.length
        ? `Esperando você (${waiting.length}):\n${waiting.map((t) => `- ${t.subject}${t.waitingFor ? `: ${t.waitingFor}` : ""} · ${consoleUrl()}/chamados/${t.id}`).join("\n")}`
        : null,
      review.length ? `Entregas em Revisão, esperando o seu teste: ${review.length}.` : null,
      bank ? `Banco de horas de ${monthOf(today).split("-").reverse().join("/")}: ${hoursLabel(bank.usedMinutes)} de ${hoursLabel(bank.includedMinutes)}.` : null,
      nextInvoice
        ? nextInvoice.dueDate < today
          ? `Fatura em aberto: ${nextInvoice.description}, ${currency(nextInvoice.amountCents)}, venceu em ${dateLabel(nextInvoice.dueDate)}. Pague pelo Console: ${consoleUrl()}/financeiro`
          : `Próxima fatura: ${nextInvoice.description}, ${currency(nextInvoice.amountCents)}, vence em ${dateLabel(nextInvoice.dueDate)}.`
        : null,
    ].filter(Boolean);
    const delivered = await mailAdministrators(company.id, {
      tag: "weekly-summary",
      key: entity,
      subject: `Sua semana com a Anuntech: ${company.name}`,
      text: `Resumo da semana no Console da Anuntech: ${company.name}.\n\n${sections.join("\n\n")}\n\nTudo isso fica na Visão geral: ${consoleUrl()}/painel\n\nAnuntech`,
    });
    if (!delivered) await release("weekly.summary", entity);
    else sent += 1;
  }
  return sent;
}

/* ---------- the runs ---------- */

/** Every 5 minutes (ticket-notifications): what should go out as soon as it happens. */
export async function runFrequentAutomations() {
  const on = await automations();
  return {
    hoursAlerts: on.hoursAlert ? await hoursAlerts() : 0,
    signed: on.contractSigned ? await contractsSigned() : 0,
  };
}

/** Once a day (client-notices, 08:00 in São Paulo): reminders, reports and summaries. */
export async function runDailyAutomations(now = new Date()) {
  const on = await automations();
  const today = saoPauloDate(now);
  const cal = await loadCalendar();
  const result: Record<string, number> = {};
  const step = async (key: AutomationKey, run: () => Promise<number>) => {
    if (!on[key]) return;
    try {
      result[key] = await run();
    } catch (error) {
      result[`${key}Failed`] = 1;
      console.warn(`[client-notices] ${key} failed`, error instanceof Error ? error.message : error);
    }
  };
  await step("hoursReport", () => hoursReports(today, cal));
  await step("quoteReminder", () => quoteReminders(today));
  await step("contractReminder", () => contractReminders());
  await step("reviewNotice", () => reviewNotices(now, cal));
  await step("waitingReminder", () => waitingReminders(now, cal));
  await step("weeklySummary", () => weeklySummaries(today, now));
  return result;
}

export const __test = { secondBusinessDay };
