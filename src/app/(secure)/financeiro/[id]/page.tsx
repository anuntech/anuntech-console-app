import type { Metadata } from "next";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  automationEvents,
  billingNotices,
  companies,
  engagements,
  invoices,
  subscriptions,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access/access";
import { addressLabel } from "@/lib/companies/company-billing";
import { saoPauloDate } from "@/lib/dates";
import { canDeleteInvoice, closedAtBank, recurrenceAllowsDelete } from "@/lib/deletion-rules";
import { interBase } from "@/lib/integrations/integrations";
import { invoiceDisplayStatus } from "@/lib/billing/invoice-table";
import { getNoticePreferences } from "@/lib/notifications/notification-preferences";
import { paymentUrl } from "@/lib/billing/payment-link";
import { addDays, earlyIssueAllowed, issueDate } from "@/lib/billing/recurrence";
import {
  InvoiceDetail,
  type InvoiceDetailData,
} from "@/components/financeiro/invoice-detail";
export const metadata: Metadata = {
  title: "Fatura",
  description: "O pagamento, os avisos e as condições de uma fatura.",
};

export default async function Invoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({
      invoice: invoices,
      company: companies,
      engagement: engagements.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .leftJoin(engagements, eq(engagements.id, invoices.engagementId))
    .where(eq(invoices.id, id));
  if (
    !row ||
    !canAccess(actor, row.invoice.companyId, "finance") ||
    (!actor.admin && !["issued", "paid"].includes(row.invoice.status))
  )
    notFound();
  const i = row.invoice;
  const [sub] = i.subscriptionId
    ? await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, i.subscriptionId))
    : [];
  const scheduled = i.status === "draft" && sub?.status === "active";
  // Whether paying this invoice would issue the next period at once: the same rule the cron applies.
  const [otherOpen, engagement] = sub
    ? await Promise.all([
        db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.subscriptionId, sub.id), eq(invoices.status, "issued"), ne(invoices.id, i.id)))
          .limit(1),
        sub.engagementId
          ? db.select({ status: engagements.status }).from(engagements).where(eq(engagements.id, sub.engagementId))
          : Promise.resolve([{ status: "active" as const }]),
      ])
    : [[], []];
  const today = saoPauloDate();
  // A charge Inter closed unpaid is still a debt until someone bills it again or writes it off (staff only).
  let debt: InvoiceDetailData["debt"] = null;
  if (actor.admin && i.status === "cancelled" && i.bankStatus === "EXPIRADO") {
    const [[teamCancel], decisions] = await Promise.all([
      db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, i.id),
            inArray(auditEvents.action, ["invoice.bank_cancelled", "invoice.bank_cancel_requested"]),
            // A reissue cancelled an earlier charge of this invoice; only a cancel of this one counts.
            sql`${auditEvents.details}->>'providerId' = ${i.providerId}`,
          ),
        )
        .limit(1),
      db.select().from(automationEvents).where(and(eq(automationEvents.entityId, i.id), inArray(automationEvents.kind, ["debt.closed", "debt.rebilled"]))),
    ]);
    if (!teamCancel) {
      const rebilled = decisions.find((d) => d.kind === "debt.rebilled");
      const closed = decisions.find((d) => d.kind === "debt.closed");
      debt = rebilled
        ? { state: "rebilled", invoiceId: String(rebilled.details?.invoiceId ?? ""), at: rebilled.createdAt.toISOString() }
        : closed
          ? { state: "closed", reason: String(closed.details?.reason ?? ""), at: closed.createdAt.toISOString() }
          : { state: "open" };
    }
  }
  const earlyReady =
    !!sub &&
    sub.status === "active" &&
    i.dueDate >= addDays(sub.nextDueDate, -40) &&
    earlyIssueAllowed({
      interval: sub.interval,
      issueOnPayment: sub.issueOnPayment,
      nextDueDate: sub.nextDueDate,
      today,
      previousStatus: "paid",
      hasOpenInvoice: otherOpen.length > 0,
      engagementActive: engagement[0]?.status === "active",
    });
  // A later period of the same recurrence already at the bank (issued early, after this one was paid).
  const [ahead] = sub
    ? await db
        .select({ id: invoices.id, dueDate: invoices.dueDate, amountCents: invoices.amountCents, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.subscriptionId, sub.id), gt(invoices.dueDate, i.dueDate), inArray(invoices.status, ["issued", "paid"])))
        .orderBy(asc(invoices.dueDate))
        .limit(1)
    : [];
  const now = new Date();
  const [notices, preferences, events] = actor.admin
    ? await Promise.all([
        db
          .select()
          .from(billingNotices)
          .where(eq(billingNotices.invoiceId, i.id))
          .orderBy(asc(billingNotices.createdAt)),
        getNoticePreferences(row.company.id, "billing"),
        db
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(inArray(auditEvents.entityId, sub ? [i.id, sub.id] : [i.id]))
          .orderBy(desc(auditEvents.createdAt))
          .limit(30),
      ])
    : [[], null, []];
  const canSend = (channel: "email" | "whatsapp") => {
    const first = notices.find(
      (n) => n.kind === "initial" && n.channel === channel,
    );
    return (
      i.status === "issued" &&
      i.publicEnabled &&
      (!first || (first.status === "failed" && first.attempts === 0))
    );
  };
  // The page only talks to the bank this deployment is configured for.
  let sameBank = false;
  try {
    sameBank = i.bankBase === interBase();
  } catch {
    sameBank = false;
  }
  const checkedAgo = i.bankCheckedAt
    ? now.getTime() - i.bankCheckedAt.getTime()
    : Infinity;
  const sync: InvoiceDetailData["sync"] =
    actor.admin && i.status === "issued" && i.providerId && sameBank
      ? !i.pixCopyPaste && !i.boletoLine
        ? "poll"
        : checkedAgo > 2 * 60_000
          ? "once"
          : "off"
      : "off";
  const requestedDueDate = i.bankRequest?.dataVencimento;
  return (
    <InvoiceDetail
      data={{
        invoice: {
          id: i.id,
          description: i.description,
          amountCents: i.amountCents,
          dueDate: i.dueDate,
          bankDueDate: i.bankDueDate,
          status: i.status,
          display: invoiceDisplayStatus(
            { status: i.status, dueDate: i.dueDate, scheduled, expired: debt?.state === "open" },
            today,
          ),
          createdAt: i.createdAt.toISOString(),
          engagement: row.engagement,
          providerId: i.providerId,
          bankStatus: i.bankStatus,
          bankCheckedAt: i.bankCheckedAt?.toISOString() ?? null,
          bankRequested: !!i.bankRequest,
          // The bank's date is compared with the date we asked it to use, not the obligation's.
          requestedDueDate:
            typeof requestedDueDate === "string" &&
            requestedDueDate !== (i.bankDueDate ?? i.dueDate)
              ? requestedDueDate
              : null,
          boletoLine: i.boletoLine,
          pixCopyPaste: i.pixCopyPaste,
          publicUrl:
            i.publicId && i.publicEnabled && ["issued", "paid"].includes(i.status)
              ? paymentUrl(i.publicId)
              : null,
          publicEnabled: i.publicEnabled,
          fiscalStatus: i.fiscalStatus,
          editable:
            i.status === "draft" &&
            !i.bankRequest &&
            (!sub || sub.status === "draft")
              ? "draft"
              : i.status === "issued"
                ? "issued"
                : null,
          // A recurrence must not bill the period again; the action refuses it too.
          deletable: actor.admin && canDeleteInvoice(i) && recurrenceAllowsDelete(i, sub) && debt?.state !== "open",
          bankClosed: closedAtBank(i),
          terms: {
            discountCents: i.discountCents,
            fineBps: i.fineBps,
            interestMonthlyBps: i.interestMonthlyBps,
          },
        },
        company: {
          id: row.company.id,
          name: row.company.name,
          document: row.company.document,
          address: row.company.billingAddress
            ? addressLabel(row.company.billingAddress)
            : null,
          autoIssueNfse: row.company.autoIssueNfse,
        },
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              interval: sub.interval,
              nextDueDate: sub.nextDueDate,
              issueDate: issueDate(sub.nextDueDate, sub.leadDays),
              amountCents: sub.amountCents,
              description: sub.description,
              // The bank's technical reason is for the team.
              lastError: actor.admin ? sub.lastError : null,
              issueOnPayment: sub.interval === "monthly" ? sub.issueOnPayment : null,
              earlyReady,
              ahead: ahead ? { ...ahead, status: ahead.status as "issued" | "paid" } : null,
              terms: {
                discountCents: sub.discountCents,
                fineBps: sub.fineBps,
                interestMonthlyBps: sub.interestMonthlyBps,
              },
            }
          : null,
        scheduled,
        debt,
        scheduledIssueDate:
          scheduled && sub ? issueDate(i.dueDate, sub.leadDays) : null,
        notices: notices.map((n) => ({
          id: n.id,
          channel: n.channel,
          kind: n.kind,
          status: n.status,
          error: n.error,
          createdAt: n.createdAt.toISOString(),
          resendable:
            i.status === "issued" &&
            i.publicEnabled &&
            ["failed", "expired", "skipped", "uncertain"].includes(n.status),
        })),
        contacts: preferences
          ? {
              email: preferences.email,
              emailEnabled: preferences.emailEnabled,
              phone: preferences.phone,
              whatsappEnabled: preferences.whatsappEnabled,
            }
          : null,
        canSend: { email: canSend("email"), whatsapp: canSend("whatsapp") },
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: e.createdAt.toISOString(),
        })),
        viewer: { admin: actor.admin },
        sync,
        today,
        now: now.toISOString(),
      }}
    />
  );
}
