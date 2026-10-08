import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  auditEvents,
  automationEvents,
  billingNotices,
  companies,
  consoleStaffMembers,
  contracts,
  invoices,
  subscriptions,
  tickets,
} from "@/db/schema";
import { db } from "../db";
import { dateLabel } from "../format";
import { normalizeEmail } from "../access/permissions";
import { saoPauloDate } from "../dates";
import { addDays, contractTerm, contractTermLabel, EXPIRY_WARNING_DAYS } from "../contracts/contract-table";
import { daysOverdue, noticeChannelLabels, noticeKindLabel, noticeStatusLabels } from "../billing/billing-notice-rules";
import { opsDigestText, type OpsDigestData } from "./ops-digest-text";
import { expiredDebts, expiringCharges, failingRecurrences, leavingCharges } from "../billing/billing-watch";
import { quietFor, staleRoutines } from "../ops/cron-health";
import { unreachableStaff } from "./ops-delivery";
import { interCertificateExpiry } from "../integrations/integrations";
import { commercialFollowUp } from "../commercial/follow-up";
import { supportFollowUp } from "../tickets/support-follow-up";
import { clientsFollowUp } from "../companies/clients-follow-up";
import { collectionFollowUp } from "../billing/collections";
import { readjustFollowUp } from "../contracts/readjust";

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
  return sendStaffMail(await staffEmails(), subject, text);
}

/** The same, to some staff addresses only (a ticket's owner). */
export async function sendStaffMail(recipients: string[], subject: string, text: string) {
  let delivered = 0;
  for (const to of recipients) {
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
      if (res.ok) {
        delivered += 1;
        // Resend accepts a suppressed address too: the delivery is checked later (ops-delivery.ts).
        const sent = (await res.json().catch(() => null)) as { id?: string } | null;
        if (sent?.id)
          await db
            .insert(automationEvents)
            .values({ kind: "ops-mail", entityId: sent.id, details: { to, subject: subject.slice(0, 120), status: "sent" } })
            .onConflictDoNothing()
            .catch(() => {});
      }
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
  const [issued, paid, paused, problems, overdue, ending, ticketsDue] = await Promise.all([
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
      .select({
        id: contracts.id,
        company: companies.name,
        title: contracts.title,
        startsAt: contracts.startsAt,
        endsAt: contracts.endsAt,
        pendingId: sql<string | null>`(select c2.id from ${contracts} c2 where c2.parent_id = ${contracts.id} and c2.status in ('draft', 'sent', 'in_review') limit 1)`,
      })
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
    // Unanswered tickets past their first-response deadline or due before the end of today.
    db
      .select({ id: tickets.id, company: companies.name, subject: tickets.subject, dueAt: tickets.responseDueAt })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(
        and(
          isNull(tickets.firstResponseAt),
          inArray(tickets.status, ["open", "in_progress"]),
          sql`${tickets.responseDueAt} < (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'`,
        ),
      )
      .orderBy(asc(tickets.responseDueAt)),
  ]);
  const [failing, expired, expiring, leaving, stale, unreachable, followUp] = await Promise.all([
    failingRecurrences(),
    expiredDebts(),
    expiringCharges(today),
    leavingCharges(today),
    staleRoutines(),
    staffEmails().then(unreachableStaff),
    Promise.all([collectionFollowUp(today), commercialFollowUp(today), readjustFollowUp(today, true), supportFollowUp(), clientsFollowUp()]).then((groups) => groups.flat()),
  ]);
  const certificateEnds = interCertificateExpiry();
  const certificateDays = certificateEnds
    ? certificateEnds.getTime() <= Date.now()
      ? -1
      : Math.ceil((certificateEnds.getTime() - Date.now()) / 86_400_000)
    : null;
  return {
    today,
    failing,
    expired,
    expiring,
    leaving,
    routines: stale.map((r) => ({ label: r.label, quiet: quietFor(r.minutes), lastError: r.lastError })),
    unreachable,
    followUp,
    certificate:
      certificateEnds && certificateDays !== null && certificateDays <= 30
        ? { expiresOn: saoPauloDate(certificateEnds), days: certificateDays }
        : null,
    issued24h: issued.length,
    paid24h: paid.length,
    paused,
    noticeProblems: problems,
    overdue: overdue.map((i) => ({ ...i, days: daysOverdue(i.dueDate, today) })),
    contracts: ending
      .map((c) => ({ id: c.id, pendingId: c.pendingId, company: c.company, title: c.title, label: contractTermLabel(contractTerm(c, today)) }))
      .filter((c): c is { id: string; pendingId: string | null; company: string; title: string; label: string } => !!c.label),
    tickets: ticketsDue.map((t) => ({ company: t.company, subject: t.subject, dueAt: t.dueAt!.toISOString(), id: t.id })),
    url: consoleUrl(),
  };
}

/** The 08:30 summary; returns how many staff addresses got it. */
export async function sendOpsDigest() {
  const data = await collectOpsDigest();
  const { subject, text } = opsDigestText(data);
  const delivered = await sendOpsMail(subject, text);
  return {
    delivered,
    problems:
      data.paused.length + data.noticeProblems.length + data.overdue.length + data.contracts.length + (data.tickets?.length ?? 0) +
      (data.failing?.length ?? 0) + (data.expired?.length ?? 0) + (data.expiring?.length ?? 0) + (data.leaving?.length ?? 0) +
      (data.routines?.length ?? 0) + (data.certificate ? 1 : 0) + (data.unreachable?.length ?? 0) +
      (data.followUp ?? []).reduce((sum, group) => sum + group.items.length, 0),
  };
}

