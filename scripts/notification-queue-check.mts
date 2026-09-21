import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { ticketNotices, notificationSettings } from "../src/db/schema";
import {
  enqueueTicketNotice,
  processTicketNotices,
} from "../src/lib/ticket-notifications";
import {
  lockTicketNotifications,
  TICKET_NOTIFICATION_KEY,
} from "../src/lib/notification-settings";
assert.match(
  new URL(process.env.DATABASE_URL!).pathname,
  /^\/console_test_[a-f0-9]+$/,
);
const fixture = JSON.parse(process.env.CONSOLE_QUEUE_FIXTURE!);
// Provider responses are local mocks; never issue network requests.
let requests = 0;
process.env.RESEND_API_KEY = "test";
process.env.EMAIL_FROM = "test@example.invalid";
process.env.FLW_SYNOVA = "test";
process.env.FLW_SENDER_NUMBER = "5511999999999";
process.env.FLW_TICKET_TEMPLATE_ID = "template-test";
globalThis.fetch = async (input) => {
  requests++;
  const url = String(input);
  if (url === "https://api.resend.com/emails")
    return Response.json({ id: "email-test" });
  if (url.startsWith("https://api.wts.chat/chat/v1/template?"))
    return Response.json({
      items: [
        {
          id: "template-test",
          active: true,
          archived: false,
          status: "APPROVED",
        },
      ],
    });
  if (url === "https://api.wts.chat/chat/v1/send/template")
    return Response.json({ id: "whatsapp-test", status: "ACCEPTED" });
  throw new Error("Unexpected network call in queue test");
};
try {
  await db.transaction((tx) =>
    enqueueTicketNotice(
      tx,
      fixture.eventId,
      {
        id: fixture.ticketId,
        companyId: fixture.companyId,
        subject: "Queue QA",
      },
      "QA",
      "Teste",
    ),
  );
  const rows = await db
    .select()
    .from(ticketNotices)
    .where(eq(ticketNotices.eventId, fixture.eventId));
  assert.equal(rows.length, fixture.enabled ? 2 : 0);
  if (!fixture.enabled) {
    assert.equal((await processTicketNotices()).processed, 0);
    assert.equal(requests, 0);
  } else {
    assert.equal((await processTicketNotices()).processed, 2);
    const delivered = await db
      .select()
      .from(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    assert.ok(
      delivered.every((row) => row.status === "accepted" && row.attempts === 1),
    );
    assert.equal(requests, 3);
    const email = delivered.find((row) => row.channel === "email")!;
    await db
      .update(ticketNotices)
      .set({ status: "pending", providerId: null, nextAttemptAt: new Date() })
      .where(eq(ticketNotices.id, email.id));
    let releaseSend!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    globalThis.fetch = async () => {
      markStarted();
      await gate;
      return Response.json({ id: "email-test-2" });
    };
    const worker = processTicketNotices();
    await started;
    let disabled = false;
    const disable = db.transaction(async (tx) => {
      await lockTicketNotifications(tx, true);
      await tx
        .update(notificationSettings)
        .set({ enabled: false })
        .where(eq(notificationSettings.id, TICKET_NOTIFICATION_KEY));
      disabled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(
      disabled,
      false,
      "Disable waits for an in-flight provider request",
    );
    releaseSend();
    await Promise.all([worker, disable]);
    assert.equal(disabled, true);
    await db
      .update(notificationSettings)
      .set({ enabled: true })
      .where(eq(notificationSettings.id, TICKET_NOTIFICATION_KEY));
    console.log("PASS Disable synchronizes with in-flight delivery");
  }
  console.log(
    `PASS Queue ${fixture.enabled ? "enabled: enqueues two channels" : "disabled: no enqueue or delivery"}`,
  );
} finally {
  await pool.end();
}
