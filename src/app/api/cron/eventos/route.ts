import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { trackedCron } from "@/lib/ops/cron-health";
import { drainEvents } from "@/lib/events/events";
import { handleEvent } from "@/lib/events/handlers";
import { scanOverdue } from "@/lib/events/scans";
import { settleAllDecisions } from "@/lib/decisions/decisions";
export const maxDuration = 300;

/**
 * Every 5 minutes, the Piloto automático: records the events no change
 * emits by itself (invoices late for days), hands every pending event to its
 * handler (each opens a decision for the team, never the change) and closes
 * the decisions the data already settled. See lib/events and lib/decisions.
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
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649301) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const overdue = await scanOverdue();
    const events = await drainEvents(handleEvent);
    const closed = await settleAllDecisions();
    const result = { overdue, ...events, closed };
    console.log(`[eventos] ${JSON.stringify(result)}`);
    return Response.json(result, { status: events.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}

export const GET = trackedCron("eventos", run);
