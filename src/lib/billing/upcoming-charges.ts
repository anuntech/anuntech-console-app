import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { companies, invoices, subscriptions } from "@/db/schema";
import { db } from "../db";
import { issueDate } from "./recurrence";
import { billingProblemsLabel, billingReadiness } from "./billing-readiness";

/**
 * The next charge of each recurrence, before it exists as an invoice: the
 * subscription keeps only its next due date until the period is issued
 * (5 days before, or as soon as the previous one is paid). Read only:
 * nothing here talks to the bank or sends anything.
 */
export type UpcomingCharge = {
  subscriptionId: string;
  companyId: string;
  company: string;
  description: string;
  amountCents: number;
  dueDate: string;
  /** The usual day of the boleto, the Pix and the client's notice. */
  issueDate: string;
  /** Monthly plan that issues the next period as soon as the current one is paid. */
  onPayment: boolean;
  status: "active" | "paused";
  /** The bank's reason a paused recurrence stopped; the team only. */
  lastError: string | null;
  /** Latest invoice of the recurrence the viewer can open, for the link. */
  invoiceId: string | null;
  /** What in the company's record will make the issue fail (the team only). */
  problems: string | null;
};

export async function upcomingCharges({ admin, companyIds }: { admin: boolean; companyIds: string[] | null }): Promise<UpcomingCharge[]> {
  if (companyIds && !companyIds.length) return [];
  const visible = admin ? sql`${invoices.status} <> 'cancelled'` : sql`${invoices.status} in ('issued', 'paid')`;
  const rows = await db
    .select({
      subscriptionId: subscriptions.id,
      companyId: subscriptions.companyId,
      company: companies.name,
      document: companies.document,
      archived: companies.archived,
      billingAddress: companies.billingAddress,
      description: subscriptions.description,
      amountCents: subscriptions.amountCents,
      dueDate: subscriptions.nextDueDate,
      leadDays: subscriptions.leadDays,
      interval: subscriptions.interval,
      issueOnPayment: subscriptions.issueOnPayment,
      status: subscriptions.status,
      lastError: subscriptions.lastError,
      invoiceId: sql<string | null>`(select ${invoices.id} from ${invoices} where ${invoices.subscriptionId} = ${subscriptions.id} and ${visible} order by ${invoices.dueDate} desc limit 1)`,
    })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .where(
      and(
        // A paused recurrence will not be issued: the team needs to see it, the client does not.
        inArray(subscriptions.status, admin ? ["active", "paused"] : ["active"]),
        companyIds ? inArray(subscriptions.companyId, companyIds) : undefined,
        // An archived client's active recurrence will fail to issue: the team sees it with the reason.
        admin ? undefined : eq(companies.archived, false),
      ),
    )
    .orderBy(asc(subscriptions.nextDueDate), asc(companies.name));
  return rows.map((row) => ({
    subscriptionId: row.subscriptionId,
    companyId: row.companyId,
    company: row.company,
    description: row.description,
    amountCents: row.amountCents,
    dueDate: row.dueDate,
    issueDate: issueDate(row.dueDate, row.leadDays),
    onPayment: row.interval === "monthly" && row.issueOnPayment,
    status: row.status as "active" | "paused",
    lastError: admin ? row.lastError : null,
    invoiceId: row.invoiceId,
    problems: admin
      ? billingProblemsLabel(billingReadiness({ name: row.company, document: row.document, archived: row.archived, billingAddress: row.billingAddress })) || null
      : null,
  }));
}
