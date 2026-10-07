import "server-only";
import { randomUUID } from "node:crypto";
import { billingNotices } from "@/db/schema";
import { db } from "../db";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
} from "../notifications/notification-preferences";
import type { BillingNoticeKind } from "./billing-notice-rules";
import { billingSendTime } from "../dates";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function enqueueBillingNotice(
  tx: Tx,
  input: {
    invoiceId: string;
    companyId: string;
    actorId: string;
    channel: "email" | "whatsapp";
    kind: BillingNoticeKind;
  },
  /**
   * `immediate` only for an admin's explicit send/resend; automatic notices
   * wait until 08h. `notBefore` holds them longer: an invoice issued early,
   * right after the previous one was paid, is still announced on its usual
   * day (5 days before the due date).
   */
  options: { immediate?: boolean; notBefore?: Date } = {},
) {
  const preferences = await getNoticePreferences(
    input.companyId,
    "billing",
    tx,
  );
  const destinations =
    input.channel === "email"
      ? noticeEmails(preferences)
      : noticePhones(preferences);
  const { companyId: _companyId, ...notice } = input;
  void _companyId;
  const morning = billingSendTime();
  const nextAttemptAt = options.immediate
    ? new Date()
    : options.notBefore && options.notBefore > morning
      ? options.notBefore
      : morning;
  await tx
    .insert(billingNotices)
    .values(
      (destinations.length ? destinations : [""]).map((recipient) => ({
        id: randomUUID(),
        ...notice,
        recipient,
        nextAttemptAt,
      })),
    )
    .onConflictDoNothing();
}
