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
  /** Only for an admin's explicit send/resend; automatic notices wait until 08h. */
  options: { immediate?: boolean } = {},
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
  const nextAttemptAt = options.immediate ? new Date() : billingSendTime();
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
