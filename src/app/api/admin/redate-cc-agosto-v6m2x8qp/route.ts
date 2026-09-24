import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Re-applies the August re-dating for Casa do Construtor: the previous
 * deployment's last reconciliation ran after the first fix and wrote the
 * bank's date back onto the due date. Idempotent; remove after use.
 */
export async function GET() {
  const fixed = await db.execute(sql`
    UPDATE "console_invoices" SET "due_date" = '2026-08-09', "bank_due_date" = '2026-10-09'
    WHERE "id" = 'f84af4fe-05c2-41bb-9e97-520dc1124a87' AND "status" = 'issued'
    RETURNING "id", "due_date", "bank_due_date"`);
  return Response.json({ fixed: fixed.rows });
}
