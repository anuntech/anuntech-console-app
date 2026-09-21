import "server-only";
import { randomUUID } from "node:crypto";
import { billingNotices } from "@/db/schema";
import { db } from "./db";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
} from "./notification-preferences";
import type { BillingNoticeKind } from "./billing-notice-rules";
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
  await tx
    .insert(billingNotices)
    .values(
      (destinations.length ? destinations : [""]).map((recipient) => ({
        id: randomUUID(),
        ...notice,
        recipient,
      })),
    )
    .onConflictDoNothing();
}
