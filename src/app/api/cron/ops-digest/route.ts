import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { sendOpsDigest } from "@/lib/notifications/ops-alerts";
import { trackedCron } from "@/lib/ops/cron-health";
export const maxDuration = 120;

/** Once a day, 08:30 in São Paulo: what needs a look, or "tudo em dia". */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649186) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const result = await sendOpsDigest();
    console.log(`[ops-digest] ${JSON.stringify(result)}`);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}

export const GET = trackedCron("ops-digest", run);
