import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { automationEvents } from "@/db/schema";
import type { db } from "../db";
import { chargeSourceEvent, preparedChargeEvents } from "./charge-sources";

type Tx = Pick<typeof db, "select" | "update" | "delete">;

/**
 * A prepared draft is cancelled or deleted: its sources can be prepared
 * again. When the draft billed an expired debt again, what the debt itself
 * was prepared from (an entrada, a recurrence) goes back to the debt, and
 * only the debt reopens.
 */
export async function releasePreparedCharges(tx: Tx, invoiceId: string) {
  const [rebilled] = await tx
    .select({ id: automationEvents.id, debtId: automationEvents.entityId })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, chargeSourceEvent.rebill), sql`${automationEvents.details}->>'invoiceId' = ${invoiceId}`));
  if (rebilled) {
    await tx
      .update(automationEvents)
      .set({ details: sql`jsonb_set(${automationEvents.details}, '{invoiceId}', to_jsonb(${rebilled.debtId}::text))` })
      .where(
        and(
          inArray(automationEvents.kind, preparedChargeEvents.filter((kind) => kind !== chargeSourceEvent.rebill)),
          sql`${automationEvents.details}->>'invoiceId' = ${invoiceId}`,
        ),
      );
    await tx.delete(automationEvents).where(eq(automationEvents.id, rebilled.id));
    return;
  }
  await tx
    .delete(automationEvents)
    .where(and(inArray(automationEvents.kind, preparedChargeEvents), sql`${automationEvents.details}->>'invoiceId' = ${invoiceId}`));
}
