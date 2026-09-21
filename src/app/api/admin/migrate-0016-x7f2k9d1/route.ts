import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0016_membership_two_roles.sql; remove after use. */
export async function GET() {
  const result = await db.execute(
    sql`UPDATE console_memberships SET role = 'member' WHERE role IN ('support', 'finance')`,
  );
  return Response.json({ rowsUpdated: result.rowCount ?? null });
}
