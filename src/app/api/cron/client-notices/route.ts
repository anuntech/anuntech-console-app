import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { runDailyAutomations } from "@/lib/automations/client-automations";
import { trackedCron } from "@/lib/ops/cron-health";
export const maxDuration = 300;

/**
 * Once a day, 09:00 in São Paulo: the client notices switched on in
 * Configurações → Automações (reminders, the month's hours report, deliveries
 * to review, the weekly summary). Each goes once; see client-automations.ts.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649187) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const result = await runDailyAutomations();
    console.log(`[client-notices] ${JSON.stringify(result)}`);
    const failed = Object.keys(result).filter((key) => key.endsWith("Failed")).length;
    return Response.json({ ...result, failed }, { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}

export const GET = trackedCron("client-notices", run);
