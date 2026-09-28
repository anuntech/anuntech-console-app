import { checkBillingDeliveries } from "@/lib/billing/billing-delivery";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { processSubscriptions } from "@/lib/billing/billing-recurring";
import {
  processBillingNotices,
  queueBillingReminders,
} from "@/lib/billing/billing-notices";
import { revalidatePath } from "next/cache";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    const locked = (
      await conn.query("select pg_try_advisory_xact_lock(72649184) as locked")
    ).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const deadline = Date.now() + 210000;
    const result = await processSubscriptions();
    console.log(`[recurring-billing] ${JSON.stringify(result)}`);
    await queueBillingReminders();
    await processBillingNotices(deadline);
    await checkBillingDeliveries(deadline + 30000);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/[id]", "page");
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
