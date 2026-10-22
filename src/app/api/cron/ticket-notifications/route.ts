import { timingSafeEqual } from "node:crypto";
import { processTicketNotices } from "@/lib/tickets/ticket-notifications";
import { remindFirstResponses } from "@/lib/tickets/ticket-watch";
import { runFrequentAutomations } from "@/lib/automations/client-automations";
import { trackedCron } from "@/lib/ops/cron-health";
import { checkPushReceipts, processPushNotices } from "@/lib/notifications/push-sender";
export const maxDuration = 60;
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const result = await processTicketNotices();
  // The team's own reminder before a first response is late; never the client.
  const reminders = await remindFirstResponses().catch((error) => {
    console.warn("[ticket-notifications] reminders failed", error instanceof Error ? error.message : error);
    return { reminded: 0 };
  });
  // Client notices that go as soon as something happens (80% of the bank, a contract signed by both sides).
  const notices = await runFrequentAutomations().catch((error) => {
    console.warn("[ticket-notifications] automations failed", error instanceof Error ? error.message : error);
    return {};
  });
  // Pushes to the native app that after() did not finish, then Expo's receipts.
  const push = await processPushNotices(Date.now() + 15000).catch((error) => {
    console.warn("[ticket-notifications] push failed", error instanceof Error ? error.message : error);
    return {};
  });
  const receipts = await checkPushReceipts().catch((error) => {
    console.warn("[ticket-notifications] push receipts failed", error instanceof Error ? error.message : error);
    return {};
  });
  return Response.json({ ...result, ...reminders, ...notices, ...push, ...receipts }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = trackedCron("ticket-notifications", run);
