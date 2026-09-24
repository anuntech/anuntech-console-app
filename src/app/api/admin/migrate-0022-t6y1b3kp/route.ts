import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0022_engagement_url.sql; idempotent, remove after use. */
export async function GET() {
  await db.execute(sql`ALTER TABLE "console_engagements" ADD COLUMN IF NOT EXISTS "url" text`);
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_engagements' ORDER BY ordinal_position`,
  );
  return Response.json({ engagementColumns: columns.rows.map((row) => row.column_name) });
}
