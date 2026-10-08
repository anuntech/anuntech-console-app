import { timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, pool } from "@/lib/db";
import { invoices } from "@/db/schema";
import { interBase } from "@/lib/integrations/integrations";
import { reconcileCharge } from "@/lib/billing/billing-sync";
import { trackedCron } from "@/lib/ops/cron-health";

export const maxDuration = 300;
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

  // A transaction lock also works with the production PgBouncer pool.
  const connection = await pool.connect();
  let locked = false;
  try {
    await connection.query("BEGIN");
    locked = (
      await connection.query(
        "select pg_try_advisory_xact_lock(72649183) as locked",
      )
    ).rows[0].locked;
    if (!locked) return Response.json({ skipped: true });
    const pending = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "issued"),
          eq(invoices.bankBase, interBase()),
          isNotNull(invoices.providerId),
          sql`(${invoices.bankCheckedAt} IS NULL OR ${invoices.bankCheckedAt} < now() - interval '4 minutes')`,
        ),
      )
      .orderBy(sql`${invoices.bankCheckedAt} ASC NULLS FIRST`, invoices.id)
      // With the next period issued on payment there are about twice as many open charges; Inter allows 120 checks a minute.
      .limit(40);
    let checked = 0;
    let failed = 0;
    // The rest waits for the next run rather than the function being cut off midway.
    const deadline = Date.now() + 200_000;
    for (let index = 0; index < pending.length && Date.now() < deadline; index += 4) {
      const results = await Promise.allSettled(
        pending.slice(index, index + 4).map(async ({ id }) => {
          await reconcileCharge(id, undefined, undefined, "scheduled");
          revalidatePath(`/financeiro/${id}`);
        }),
      );
      for (const result of results) {
        if (result.status === "fulfilled") checked++;
        else failed++;
      }
    }
    if (checked) {
      revalidatePath("/financeiro");
      revalidatePath("/painel");
    }
    return Response.json(
      { checked, failed },
      { status: failed ? 503 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    try {
      await connection.query("ROLLBACK");
    } finally {
      connection.release();
    }
  }
}

export const GET = trackedCron("billing-sync", run);
