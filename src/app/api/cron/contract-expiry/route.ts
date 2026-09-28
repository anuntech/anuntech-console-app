import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { processContractExpiry } from "@/lib/contracts/contract-expiry";
export const maxDuration = 120;

/** Once a day: warns about contracts ending soon or already ended. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const locked = (await conn.query("select pg_try_advisory_xact_lock(72649185) as locked")).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const result = await processContractExpiry();
    if (result.expiring || result.expired) revalidatePath("/contratos");
    return Response.json(result, {
      status: result.failed ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}
