import { timingSafeEqual } from "node:crypto";
import { processTicketNotices } from "@/lib/tickets/ticket-notifications";
import { trackedCron } from "@/lib/ops/cron-health";
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
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = trackedCron("ticket-notifications", run);
