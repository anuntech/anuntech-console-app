import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  billingNotices,
  companies,
  engagements,
  invoices,
  subscriptions,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { addressLabel } from "@/lib/company-billing";
import { saoPauloDate } from "@/lib/dates";
import { canDeleteDraftInvoice } from "@/lib/deletion-rules";
import { interBase } from "@/lib/integrations";
import { invoiceDisplayStatus } from "@/lib/invoice-table";
import { getNoticePreferences } from "@/lib/notification-preferences";
import { paymentUrl } from "@/lib/payment-link";
import { issueDate } from "@/lib/recurrence";
import {
  InvoiceDetail,
  type InvoiceDetailData,
} from "@/components/financeiro/invoice-detail";
export const metadata: Metadata = {
  title: "Fatura",
  description: "Consulte o pagamento, os avisos e as condições desta fatura.",
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
  const today = saoPauloDate();
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
            { status: i.status, dueDate: i.dueDate, scheduled },
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
          // A recurrence that already ran would bill the period again; the action refuses it too.
          deletable: actor.admin && (!sub || sub.status === "draft") && canDeleteDraftInvoice(i),
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
              lastError: sub.lastError,
              terms: {
                discountCents: sub.discountCents,
                fineBps: sub.fineBps,
                interestMonthlyBps: sub.interestMonthlyBps,
              },
            }
          : null,
        scheduled,
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
