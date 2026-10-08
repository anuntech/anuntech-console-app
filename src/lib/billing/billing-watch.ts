import "server-only";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { auditEvents, automationEvents, companies, contracts, engagements, invoices, subscriptions } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { billingProblemsLabel, billingReadiness } from "./billing-readiness";
import { addDays, issueDate } from "./recurrence";

/*
 * What the team should look at before money is lost, read for the morning
 * digest and the team's overview. Read only: nothing here talks to the bank
 * or sends anything.
 */

/** Active recurrences that will fail when they issue: an incomplete record, or an early issue that already failed. */
export async function failingRecurrences() {
  const rows = await db
    .select({
      id: subscriptions.id,
      companyId: companies.id,
      company: companies.name,
      document: companies.document,
      archived: companies.archived,
      billingAddress: companies.billingAddress,
      description: subscriptions.description,
      nextDueDate: subscriptions.nextDueDate,
      leadDays: subscriptions.leadDays,
      lastError: subscriptions.lastError,
    })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .where(eq(subscriptions.status, "active"))
    .orderBy(asc(subscriptions.nextDueDate));
  return rows
    .map((row) => {
      const problems = billingReadiness({ name: row.company, document: row.document, archived: row.archived, billingAddress: row.billingAddress });
      const reason = problems.length ? `Cadastro: ${billingProblemsLabel(problems)}` : row.lastError;
      return reason
        ? { id: row.id, companyId: row.companyId, company: row.company, description: row.description, issueDate: issueDate(row.nextDueDate, row.leadDays), reason }
        : null;
    })
    .filter((row) => row !== null);
}

/**
 * A charge Inter closed for lack of payment ("Expirada"), not one the team
 * cancelled, and nobody has decided about yet. A reissue cancels the earlier
 * charge of the same invoice, so only a cancel of this very charge counts.
 */
const openExpired = sql`${invoices.status} = 'cancelled' and ${invoices.bankStatus} = 'EXPIRADO'
  and not exists (select 1 from ${auditEvents} where ${auditEvents.entityId} = ${invoices.id} and ${auditEvents.action} in ('invoice.bank_cancelled', 'invoice.bank_cancel_requested') and ${auditEvents.details}->>'providerId' = ${invoices.providerId})
  and not exists (select 1 from ${automationEvents} where ${automationEvents.entityId} = ${invoices.id} and ${automationEvents.kind} in ('debt.closed', 'debt.rebilled'))`;
export const expiredDebtCondition = openExpired;

export async function expiredDebts() {
  return db
    .select({ id: invoices.id, company: companies.name, description: invoices.description, amountCents: invoices.amountCents, dueDate: invoices.dueDate })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(openExpired)
    .orderBy(asc(invoices.dueDate));
}

/** The day Inter closes an open charge: the date asked of the bank plus the agreed days after it. */
const expiresOn = sql<string>`(coalesce((${invoices.bankRequest}->>'dataVencimento')::date, ${invoices.dueDate}) + coalesce((${invoices.bankRequest}->>'numDiasAgenda')::int, 30))::text`;

/** Open charges Inter will close within a week if nobody pays or reissues them. */
export async function expiringCharges(today = saoPauloDate()) {
  return db
    .select({ id: invoices.id, company: companies.name, description: invoices.description, amountCents: invoices.amountCents, expiresOn })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(and(eq(invoices.status, "issued"), isNotNull(invoices.providerId), sql`${expiresOn}::date between ${today}::date and ${addDays(today, 7)}::date`))
    .orderBy(asc(expiresOn));
}

/** Active recurrences of a project or service that stopped, or whose contract ended with nothing after it. */
export async function leavingCharges(today = saoPauloDate()) {
  const rows = await db
    .select({
      id: subscriptions.id,
      company: companies.name,
      description: subscriptions.description,
      nextDueDate: subscriptions.nextDueDate,
      leadDays: subscriptions.leadDays,
      engagementStatus: engagements.status,
      // Amendments move the original's dates when signed; one without dates says nothing about the term.
      contractEnded: sql<boolean>`exists (select 1 from ${contracts} c where c.engagement_id = ${engagements.id} and c.kind = 'contract' and c.status = 'signed' and c.ends_at < ${today})
        and not exists (select 1 from ${contracts} c where c.engagement_id = ${engagements.id} and c.kind = 'contract' and c.status = 'signed' and (c.ends_at is null or c.ends_at >= ${today}))`,
    })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    // Linked either way: the catalog writes engagements.subscription_id, Nova cobrança only subscriptions.engagement_id.
    .innerJoin(engagements, or(eq(engagements.subscriptionId, subscriptions.id), eq(subscriptions.engagementId, engagements.id)))
    .where(eq(subscriptions.status, "active"))
    .orderBy(asc(subscriptions.nextDueDate));
  const seen = new Set<string>();
  return rows
    .filter((row) => row.engagementStatus !== "active" || row.contractEnded)
    .filter((row) => !seen.has(row.id) && !!seen.add(row.id))
    .map((row) => ({
      id: row.id,
      company: row.company,
      description: row.description,
      issueDate: issueDate(row.nextDueDate, row.leadDays),
      reason: row.engagementStatus === "completed" ? "serviço concluído" : row.engagementStatus === "paused" ? "serviço pausado" : "contrato vencido sem renovação",
    }));
}

/** Companies with an open debt whose amount the team should still see (used by Financeiro filters). */
export async function expiredDebtIds(companyIds: string[] | null) {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(openExpired, companyIds ? inArray(invoices.companyId, companyIds) : undefined));
  return rows.map((row) => row.id);
}
