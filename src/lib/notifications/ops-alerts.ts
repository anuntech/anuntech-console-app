import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm";
import {
  auditEvents,
  billingNotices,
  companies,
  consoleStaffMembers,
  contracts,
  invoices,
  subscriptions,
} from "@/db/schema";
import { db } from "../db";
import { dateLabel } from "../format";
import { normalizeEmail } from "../access/permissions";
import { saoPauloDate } from "../dates";
import { addDays, contractTerm, contractTermLabel, EXPIRY_WARNING_DAYS } from "../contracts/contract-table";
import { daysOverdue, noticeChannelLabels, noticeKindLabel, noticeStatusLabels } from "../billing/billing-notice-rules";
import { opsDigestText, type OpsDigestData } from "./ops-digest-text";

const consoleUrl = () => process.env.BETTER_AUTH_URL || "http://localhost:3100";

/** The Anuntech people who get operational alerts: the owner and active staff. */
export async function staffEmails() {
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  const members = await db
    .select({ email: consoleStaffMembers.email })
    .from(consoleStaffMembers)
    .where(eq(consoleStaffMembers.active, true));
  return [...new Set([owner, ...members.map((m) => m.email)].filter((e): e is string => !!e).map(normalizeEmail))];
}

/** One plain-text e-mail to every staff address; a failure never breaks the caller. */
export async function sendOpsMail(subject: string, text: string) {
  let delivered = 0;
  for (const to of await staffEmails()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `ops-${randomUUID()}`,
        },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) delivered += 1;
    } catch {
      /* The alert is best effort; the digest repeats what is still open. */
    }
  }
  return delivered;
}

/** A recurrence the cron could not issue, with the reason it recorded. */
export async function alertRecurrencePaused(subscriptionId: string, error: string) {
  try {
    const [row] = await db
      .select({ company: companies.name, description: subscriptions.description, nextDueDate: subscriptions.nextDueDate })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(eq(subscriptions.id, subscriptionId));
    if (!row) return;
    await sendOpsMail(
      `[Console] Recorrência pausada: ${row.company} · ${row.description}`,
      `A emissão automática de ${row.description} para ${row.company} (vencimento ${dateLabel(row.nextDueDate)}) falhou e a recorrência foi pausada.\n\nMotivo: ${error}\n\nCorrija o cadastro e retome a recorrência pelo Console: ${consoleUrl()}/financeiro\n\nConsole da Anuntech`,
    );
  } catch {
    /* Never let an alert break the billing run. */
  }
}

/** A client notice that will not go out by itself any more. */
export async function alertNoticeProblem(noticeId: string) {
  try {
    const [row] = await db
      .select({
        company: companies.name,
        description: invoices.description,
        invoiceId: invoices.id,
        channel: billingNotices.channel,
        kind: billingNotices.kind,
        status: billingNotices.status,
        error: billingNotices.error,
      })
      .from(billingNotices)
      .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(eq(billingNotices.id, noticeId));
    if (!row) return;
    const channel = noticeChannelLabels[row.channel] ?? row.channel;
    await sendOpsMail(
      `[Console] Aviso ${(noticeStatusLabels[row.status] ?? row.status).toLowerCase()}: ${row.company} · ${row.description}`,
      `O aviso "${noticeKindLabel(row.kind)}" por ${channel} da fatura ${row.description} (${row.company}) ficou como "${noticeStatusLabels[row.status] ?? row.status}" e não será reenviado sozinho.\n\n${row.error ?? ""}\n\nConfira o contato do cliente e reenvie pela fatura: ${consoleUrl()}/financeiro/${row.invoiceId}\n\nConsole da Anuntech`,
    );
  } catch {
    /* Best effort. */
  }
}

/** What the morning summary looks at, as of today in São Paulo. */
export async function collectOpsDigest(today = saoPauloDate()): Promise<OpsDigestData> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const [issued, paid, paused, problems, overdue, ending] = await Promise.all([
    db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "invoice.bank_accepted"), gte(auditEvents.createdAt, since))),
    db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.status, "paid"), gte(invoices.bankCheckedAt, since))),
    db
      .select({
        company: companies.name,
        description: subscriptions.description,
        nextDueDate: subscriptions.nextDueDate,
        error: subscriptions.lastError,
      })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(eq(subscriptions.status, "paused"))
      .orderBy(subscriptions.nextDueDate),
    db
      .select({
        company: companies.name,
        description: invoices.description,
        channel: billingNotices.channel,
        kind: billingNotices.kind,
        status: billingNotices.status,
        error: billingNotices.error,
      })
      .from(billingNotices)
      .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(
        and(
          inArray(billingNotices.status, ["failed", "expired", "uncertain"]),
          gte(billingNotices.nextAttemptAt, since),
        ),
      )
      .orderBy(desc(billingNotices.nextAttemptAt)),
    db
      .select({
        company: companies.name,
        description: invoices.description,
        amountCents: invoices.amountCents,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(and(eq(invoices.status, "issued"), lt(invoices.dueDate, today)))
      .orderBy(invoices.dueDate),
    db
      .select({ company: companies.name, title: contracts.title, startsAt: contracts.startsAt, endsAt: contracts.endsAt })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(
        and(
          eq(contracts.status, "signed"),
          eq(contracts.kind, "contract"),
          or(lt(contracts.endsAt, today), lte(contracts.endsAt, horizon)),
        ),
      )
      .orderBy(contracts.endsAt),
  ]);
  return {
    today,
    issued24h: issued.length,
    paid24h: paid.length,
    paused,
    noticeProblems: problems,
    overdue: overdue.map((i) => ({ ...i, days: daysOverdue(i.dueDate, today) })),
    contracts: ending
      .map((c) => ({ company: c.company, title: c.title, label: contractTermLabel(contractTerm(c, today)) }))
      .filter((c): c is { company: string; title: string; label: string } => !!c.label),
    url: consoleUrl(),
  };
}

/** The 08:30 summary; returns how many staff addresses got it. */
export async function sendOpsDigest() {
  const data = await collectOpsDigest();
  const { subject, text } = opsDigestText(data);
  const delivered = await sendOpsMail(subject, text);
  return { delivered, problems: data.paused.length + data.noticeProblems.length + data.overdue.length + data.contracts.length };
}

