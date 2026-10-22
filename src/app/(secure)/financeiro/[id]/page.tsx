import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auditEvents, billingNotices, invoices } from "@/db/schema";
import { allowedIds, getActor } from "@/lib/access/access";
import { findInvoice } from "@/lib/billing/invoice-access";
import { addressLabel } from "@/lib/companies/company-billing";
import { saoPauloDate } from "@/lib/dates";
import { canDeleteInvoice, closedAtBank, recurrenceAllowsDelete } from "@/lib/deletion-rules";
import { interBase } from "@/lib/integrations/integrations";
import { invoiceDisplayStatus } from "@/lib/billing/invoice-table";
import { getNoticePreferences } from "@/lib/notifications/notification-preferences";
import { paymentUrl } from "@/lib/billing/payment-link";
import { invoiceDebt } from "@/lib/billing/invoice-debt";
import { missedPeriods, issueDate } from "@/lib/billing/recurrence";
import { invoiceRecurrence } from "@/lib/billing/invoice-recurrence";
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
  const row = await findInvoice(actor, id);
  if (!row) notFound();
  const i = row.invoice;
  const today = saoPauloDate();
  // The recurrence, whether paying now issues the next period, and a later period already at the bank.
  const { sub, earlyReady, ahead } = await invoiceRecurrence(i, today);
  const scheduled = i.status === "draft" && sub?.status === "active";
  // Paused past its due date: the periods that went by, to bill as drafts when it resumes (a period the routine already drafted keeps its draft).
  const missed = actor.admin && sub && sub.status === "paused" && sub.nextDueDate <= saoPauloDate() ? missedPeriods(sub, saoPauloDate()) : null;
  const ownDrafts = missed?.missed.length
    ? await db
        .select({ dueDate: invoices.dueDate })
        .from(invoices)
        .where(and(eq(invoices.subscriptionId, sub!.id), inArray(invoices.dueDate, missed.missed), eq(invoices.status, "draft")))
    : [];
  // A charge Inter closed unpaid is still a debt until someone bills it again or writes it off (staff only).
  const debt: InvoiceDetailData["debt"] = actor.admin ? await invoiceDebt(i) : null;
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
          fiscalUrl: i.fiscalUrl,
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
              ahead: ahead ?? null,
              resume: missed ? { ...missed, drafted: ownDrafts.map((d) => d.dueDate) } : null,
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
        // A client with a single company is not named back to itself.
        viewer: { admin: actor.admin, companies: actor.admin ? 0 : allowedIds(actor, "finance").length },
        sync,
        today,
        now: now.toISOString(),
      }}
    />
  );
}
