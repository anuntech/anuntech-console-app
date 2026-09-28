import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { enqueueBillingNotice } from "../src/lib/billing/billing-notice-queue";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import {
  ticketNotices,
  notificationSettings,
  notificationPreferences,
  billingNotices,
  invoices,
  auditEvents,
} from "../src/db/schema";
import {
  enqueueTicketNotice,
  processTicketNotices,
} from "../src/lib/tickets/ticket-notifications";
import {
  lockTicketNotifications,
  TICKET_NOTIFICATION_KEY,
} from "../src/lib/notifications/notification-settings";
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
    const key = `${fixture.companyId}:tickets`;
    await db.insert(notificationPreferences).values({
      key,
      companyId: fixture.companyId,
      topic: "tickets",
      email: "support@example.invalid",
      phone: "11988887777",
      emailEnabled: true,
      whatsappEnabled: false,
    });
    await db.transaction((tx) =>
      enqueueTicketNotice(
        tx,
        fixture.eventId,
        {
          id: fixture.ticketId,
          companyId: fixture.companyId,
          subject: "Company opt-in",
        },
        "QA",
        "Nova resposta",
      ),
    );
    await processTicketNotices();
    const clientRows = await db
      .select()
      .from(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    assert.equal(clientRows.length, 2);
    assert.ok(clientRows.every((row) => row.preferenceKey === key));
    assert.equal(
      clientRows.find((row) => row.channel === "email")?.status,
      "accepted",
    );
    assert.equal(
      clientRows.find((row) => row.channel === "whatsapp")?.status,
      "cancelled",
    );
    assert.equal(
      requests,
      1,
      "Global toggle does not suppress client opt-in delivery",
    );
    await db
      .update(notificationPreferences)
      .set({ email: "changed@example.invalid" })
      .where(eq(notificationPreferences.key, key));
    await db
      .update(ticketNotices)
      .set({ status: "pending", providerId: null, nextAttemptAt: new Date() })
      .where(
        eq(
          ticketNotices.id,
          clientRows.find((row) => row.channel === "email")!.id,
        ),
      );
    await processTicketNotices();
    assert.equal(
      requests,
      1,
      "Changed recipient never retries a frozen message to the old address",
    );
    const [cancelled] = await db
      .select()
      .from(ticketNotices)
      .where(
        eq(
          ticketNotices.id,
          clientRows.find((row) => row.channel === "email")!.id,
        ),
      );
    assert.equal(cancelled.status, "cancelled");
    await db
      .delete(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    await db
      .update(notificationPreferences)
      .set({
        emails: [
          "first@example.invalid",
          "second@example.invalid",
          "first@example.invalid",
        ],
        phones: ["11988887777", "11977776666"],
        emailEnabled: true,
        whatsappEnabled: true,
      })
      .where(eq(notificationPreferences.key, key));
    await db.transaction((tx) =>
      enqueueTicketNotice(
        tx,
        fixture.eventId,
        {
          id: fixture.ticketId,
          companyId: fixture.companyId,
          subject: "Multiple recipients",
        },
        "QA",
        "Resposta",
      ),
    );
    await db.transaction((tx) =>
      enqueueTicketNotice(
        tx,
        fixture.eventId,
        {
          id: fixture.ticketId,
          companyId: fixture.companyId,
          subject: "Multiple recipients",
        },
        "QA",
        "Resposta",
      ),
    );
    let multiple = await db
      .select()
      .from(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    assert.equal(
      multiple.length,
      4,
      "Two emails and two phones receive separate, deduplicated notices",
    );
    await processTicketNotices();
    multiple = await db
      .select()
      .from(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    assert.ok(
      multiple.every((row) => row.status === "accepted" && row.attempts === 1),
    );
    const removed = multiple.find(
      (row) => row.destination === "second@example.invalid",
    )!;
    await db
      .update(notificationPreferences)
      .set({ emails: ["first@example.invalid"] })
      .where(eq(notificationPreferences.key, key));
    await db
      .update(ticketNotices)
      .set({ status: "pending", providerId: null, nextAttemptAt: new Date() })
      .where(eq(ticketNotices.id, removed.id));
    const before = requests;
    await processTicketNotices();
    assert.equal(
      requests,
      before,
      "Removed contact cannot receive frozen retry",
    );
    const [cancelledRecipient] = await db
      .select()
      .from(ticketNotices)
      .where(eq(ticketNotices.id, removed.id));
    assert.equal(cancelledRecipient.status, "cancelled");
    await db
      .delete(ticketNotices)
      .where(eq(ticketNotices.eventId, fixture.eventId));
    const [event] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.id, fixture.eventId));
    const invoiceId = randomUUID();
    await db
      .insert(invoices)
      .values({
        id: invoiceId,
        companyId: fixture.companyId,
        description: "Multiple contacts QA",
        amountCents: 10000,
        dueDate: "2099-01-01",
      });
    const billingKey = `${fixture.companyId}:billing`;
    await db
      .insert(notificationPreferences)
      .values({
        key: billingKey,
        companyId: fixture.companyId,
        topic: "billing",
        email: "first@example.invalid",
        phone: "11988887777",
        emails: ["first@example.invalid", "second@example.invalid"],
        phones: ["11988887777", "11977776666"],
        emailEnabled: true,
        whatsappEnabled: true,
      });
    for (let attempt = 0; attempt < 2; attempt++)
      for (const channel of ["email", "whatsapp"] as const)
        await db.transaction((tx) =>
          enqueueBillingNotice(tx, {
            invoiceId,
            companyId: fixture.companyId,
            actorId: event.actorId!,
            channel,
            kind: "initial",
          }),
        );
    const billing = await db
      .select()
      .from(billingNotices)
      .where(eq(billingNotices.invoiceId, invoiceId));
    assert.equal(billing.length, 4);
    assert.equal(new Set(billing.map((row) => row.recipient)).size, 4);
    await db
      .delete(billingNotices)
      .where(eq(billingNotices.invoiceId, invoiceId));
    await db.delete(invoices).where(eq(invoices.id, invoiceId));
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.key, billingKey));
    console.log(
      "PASS Multiple contacts: independent deliveries, no duplicate queue entries and removed recipients blocked",
    );
    await db
      .delete(notificationPreferences)
      .where(eq(notificationPreferences.key, key));
    console.log(
      "PASS Company opt-in is independent of global toggle; frozen destination changes cancel delivery",
    );
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
