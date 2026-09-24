import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0025_charge_terms.sql; idempotent, remove after use. */
export async function GET() {
  for (const table of ["console_invoices", "console_subscriptions"]) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "discount_cents" integer`));
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "fine_bps" integer`));
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "interest_monthly_bps" integer`));
  }
  const columns = await db.execute(
    sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('console_invoices','console_subscriptions') AND column_name IN ('discount_cents','fine_bps','interest_monthly_bps') ORDER BY table_name, column_name`,
  );
  return Response.json({ columns: columns.rows });
}
