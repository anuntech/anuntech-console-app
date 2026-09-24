import "server-only";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import { billingNotices, companies, invoices, subscriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { getNoticePreferences } from "@/lib/notification-preferences";

/** Read-only: invoices issued in the last 24 h, their notices and the company's contact channels. Remove after use. */
export async function GET() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: invoices.id,
      company: companies.name,
      companyId: companies.id,
      description: invoices.description,
      status: invoices.status,
      dueDate: invoices.dueDate,
      amountCents: invoices.amountCents,
      publicId: invoices.publicId,
      subscriptionId: invoices.subscriptionId,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(gte(invoices.bankCheckedAt, since))
    .orderBy(asc(companies.name), asc(invoices.dueDate));
  const notices = rows.length
    ? await db
        .select({
          invoiceId: billingNotices.invoiceId,
          channel: billingNotices.channel,
          kind: billingNotices.kind,
          status: billingNotices.status,
          recipient: billingNotices.recipient,
          nextAttemptAt: billingNotices.nextAttemptAt,
          attempts: billingNotices.attempts,
          error: billingNotices.error,
        })
        .from(billingNotices)
        .where(inArray(billingNotices.invoiceId, rows.map((r) => r.id)))
        .orderBy(desc(billingNotices.nextAttemptAt))
    : [];
  const subs = rows.length
    ? await db
        .select({ id: subscriptions.id, status: subscriptions.status, nextDueDate: subscriptions.nextDueDate, leadDays: subscriptions.leadDays })
        .from(subscriptions)
        .where(inArray(subscriptions.id, rows.map((r) => r.subscriptionId).filter((id): id is string => !!id)))
    : [];
  const preferences: Record<string, unknown> = {};
  for (const companyId of new Set(rows.map((r) => r.companyId))) {
    const p = await getNoticePreferences(companyId, "billing");
    preferences[companyId] = {
      email: p.email,
      emails: p.emails,
      phone: p.phone ? `…${p.phone.slice(-4)}` : "",
      phones: p.phones?.length ?? 0,
      emailEnabled: p.emailEnabled,
      whatsappEnabled: p.whatsappEnabled,
    };
  }
  return Response.json({
    invoices: rows.map((r) => ({
      ...r,
      recipientsMasked: true,
      subscription: subs.find((s) => s.id === r.subscriptionId) ?? null,
      notices: notices
        .filter((n) => n.invoiceId === r.id)
        .map((n) => ({ ...n, recipient: n.recipient.includes("@") ? n.recipient.replace(/^(.).*@/, "$1…@") : `…${n.recipient.slice(-4)}` })),
    })),
    preferences,
  });
}
