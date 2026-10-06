import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: adds console_subscriptions.issue_on_payment in production (drizzle/0037). Removed right after it runs. */
const TOKEN_SHA256 = "a6970da9646d1f0b248811b6e08264984d4822bee72b74120230a2784c816949";

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  await db.execute(sql.raw('ALTER TABLE "console_subscriptions" ADD COLUMN IF NOT EXISTS "issue_on_payment" boolean DEFAULT true NOT NULL'));
  const rows = (
    await db.execute(sql`select count(*)::int as n, count(*) filter (where issue_on_payment)::int as on_payment from console_subscriptions`)
  ).rows as { n: number; on_payment: number }[];
  return Response.json({ ok: true, subscriptions: rows[0].n, issueOnPayment: rows[0].on_payment });
}
