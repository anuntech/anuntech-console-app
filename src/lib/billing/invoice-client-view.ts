import { daysOverdue } from "./billing-notice-rules";
import { hasTerms, lateFeesLabel, type ChargeTerms } from "./billing-terms";
import { issueDate } from "./recurrence";

/*
 * What the web's invoice page shows the client, as plain data for the app
 * (finance.list and finance.get): the same rules as
 * components/financeiro/invoice-detail.tsx and invoices-table.tsx. Pure, so
 * it is tested without a database.
 */

type Status = "draft" | "issued" | "paid" | "cancelled";

/** "N dias de atraso": counted only while the invoice shows as overdue. */
export function overdueDays(display: string, dueDate: string, today: string) {
  return display === "overdue" ? Math.max(0, daysOverdue(dueDate, today)) : 0;
}

/** The bank holds the charge but has not sent the Pix and the boleto yet. */
export function invoiceProcessing(invoice: {
  status: Status;
  providerId: string | null;
  pixCopyPaste: string | null;
  boletoLine: string | null;
}) {
  return invoice.status === "issued" && !!invoice.providerId && !invoice.pixCopyPaste && !invoice.boletoLine;
}

/** Discount until the due date and late fees after it, only while the charge can still be paid. */
export function invoiceTermsView(invoice: { status: Status; amountCents: number } & ChargeTerms) {
  if (!hasTerms(invoice) || invoice.status === "paid" || invoice.status === "cancelled") return null;
  return {
    discountCents: invoice.discountCents || null,
    /** What paying on time costs, when there is a discount. */
    onTimeCents: invoice.discountCents ? invoice.amountCents - invoice.discountCents : null,
    fineBps: invoice.fineBps,
    interestMonthlyBps: invoice.interestMonthlyBps,
    /** "multa de 2% e juros de 1% ao mês", or null without late fees. */
    lateFees: lateFeesLabel(invoice) || null,
  };
}

/**
 * The "Nota fiscal" card: shown once it was requested, or when the invoice is
 * paid (the team also sees it while issued). The link only once authorized.
 */
export function invoiceFiscalView(
  invoice: { status: Status; fiscalStatus: "not_requested" | "processing" | "authorized" | "error"; fiscalUrl: string | null },
  admin: boolean,
) {
  const settled = invoice.status === "issued" || invoice.status === "paid";
  const shown = invoice.fiscalStatus !== "not_requested" || (admin ? settled : invoice.status === "paid");
  if (!shown) return null;
  return {
    status: invoice.fiscalStatus,
    url: invoice.fiscalStatus === "authorized" ? invoice.fiscalUrl : null,
  };
}

/**
 * The charge's recurrence: Mensal or Anual and, while the recurrence is
 * active and this invoice is issued or paid, what comes next. A later period
 * already at the bank wins over the subscription's next due date.
 */
export function invoiceRecurrenceView(
  invoice: { status: Status },
  sub: {
    interval: "monthly" | "yearly";
    status: string;
    nextDueDate: string;
    leadDays: number;
    amountCents: number;
  } | null | undefined,
  earlyReady: boolean,
  ahead: { id: string; dueDate: string; amountCents: number; status: "issued" | "paid" } | null | undefined,
) {
  if (!sub) return null;
  const settled = invoice.status === "issued" || invoice.status === "paid";
  const going = sub.status === "active" && settled;
  return {
    interval: sub.interval,
    ahead: going && ahead ? ahead : null,
    next:
      going && !ahead
        ? {
            amountCents: sub.amountCents,
            dueDate: sub.nextDueDate,
            issueDate: issueDate(sub.nextDueDate, sub.leadDays),
            /** Paying this invoice issues the next period at once ("saem assim que esta for paga"). */
            onPayment: earlyReady && invoice.status !== "paid",
          }
        : null,
  };
}
