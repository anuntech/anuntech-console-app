import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, invoices } from "@/db/schema";
import { nextDueDate } from "./recurrence";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function advanceSubscription(
  tx: Transaction,
  invoice: typeof invoices.$inferSelect,
) {
  if (!invoice.subscriptionId || !["issued", "paid"].includes(invoice.status))
    return;
  const [sub] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, invoice.subscriptionId))
    .for("update");
  if (!sub || sub.nextDueDate !== invoice.dueDate) return;
  await tx
    .update(subscriptions)
    .set({
      nextDueDate: nextDueDate(
        invoice.dueDate,
        sub.interval,
        sub.anchorDay,
        sub.anchorMonth,
      ),
      lastError: null,
    })
    .where(
      and(
        eq(subscriptions.id, sub.id),
        eq(subscriptions.nextDueDate, invoice.dueDate),
      ),
    );
}
