import "server-only";
import { and, asc, eq, gt, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { engagements, invoices, subscriptions } from "@/db/schema";
import { addDays, earlyIssueAllowed } from "./recurrence";

/**
 * An invoice's recurrence, as its page shows it: the subscription, whether
 * paying this invoice would issue the next period at once (the same rule the
 * cron applies) and the later period already at the bank, if any. Read only.
 * Used by /financeiro/[id] and the app's finance.get.
 */
export async function invoiceRecurrence(
  invoice: { id: string; subscriptionId: string | null; dueDate: string },
  today: string,
) {
  const [sub] = invoice.subscriptionId
    ? await db.select().from(subscriptions).where(eq(subscriptions.id, invoice.subscriptionId))
    : [];
  if (!sub) return { sub: undefined, earlyReady: false, ahead: undefined };
  const [otherOpen, engagement] = await Promise.all([
    db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, sub.id), eq(invoices.status, "issued"), ne(invoices.id, invoice.id)))
      .limit(1),
    sub.engagementId
      ? db.select({ status: engagements.status }).from(engagements).where(eq(engagements.id, sub.engagementId))
      : Promise.resolve([{ status: "active" as const }]),
  ]);
  const earlyReady =
    sub.status === "active" &&
    invoice.dueDate >= addDays(sub.nextDueDate, -40) &&
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
  const [ahead] = await db
    .select({ id: invoices.id, dueDate: invoices.dueDate, amountCents: invoices.amountCents, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.subscriptionId, sub.id), gt(invoices.dueDate, invoice.dueDate), inArray(invoices.status, ["issued", "paid"])))
    .orderBy(asc(invoices.dueDate))
    .limit(1);
  return {
    sub,
    earlyReady,
    ahead: ahead ? { ...ahead, status: ahead.status as "issued" | "paid" } : undefined,
  };
}
