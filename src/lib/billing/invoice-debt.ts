import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { auditEvents, automationEvents } from "@/db/schema";
import { db } from "../db";

export type InvoiceDebt =
  | { state: "open" }
  | { state: "rebilled"; invoiceId: string; at: string }
  | { state: "closed"; reason: string; at: string }
  | null;

/**
 * A charge the Inter closed unpaid (EXPIRADO) is still a debt until the team
 * bills it again or writes it off. A cancel the team asked for is not a debt.
 * The staff invoice page and the public payment page read the same answer,
 * so the client is never told there is nothing to pay while there is.
 */
export async function invoiceDebt(invoice: { id: string; status: string; bankStatus: unknown; providerId: string | null }): Promise<InvoiceDebt> {
  if (invoice.status !== "cancelled" || invoice.bankStatus !== "EXPIRADO") return null;
  const [[teamCancel], decisions] = await Promise.all([
    db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityId, invoice.id),
          inArray(auditEvents.action, ["invoice.bank_cancelled", "invoice.bank_cancel_requested"]),
          // A reissue cancelled an earlier charge of this invoice; only a cancel of this one counts.
          sql`${auditEvents.details}->>'providerId' = ${invoice.providerId}`,
        ),
      )
      .limit(1),
    db.select().from(automationEvents).where(and(eq(automationEvents.entityId, invoice.id), inArray(automationEvents.kind, ["debt.closed", "debt.rebilled"]))),
  ]);
  if (teamCancel) return null;
  const rebilled = decisions.find((d) => d.kind === "debt.rebilled");
  const closed = decisions.find((d) => d.kind === "debt.closed");
  return rebilled
    ? { state: "rebilled", invoiceId: String(rebilled.details?.invoiceId ?? ""), at: rebilled.createdAt.toISOString() }
    : closed
      ? { state: "closed", reason: String(closed.details?.reason ?? ""), at: closed.createdAt.toISOString() }
      : { state: "open" };
}
