import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * One-shot runner for drizzle/0028_invoice_bank_due_date.sql, plus the one
 * migrated debt already issued with the boleto's date as its due date
 * (Casa do Construtor, August). Idempotent; remove after use.
 */
export async function GET() {
  await db.execute(sql`ALTER TABLE "console_invoices" ADD COLUMN IF NOT EXISTS "bank_due_date" date`);
  const fixed = await db.execute(sql`
    UPDATE "console_invoices" SET "due_date" = '2026-08-09', "bank_due_date" = '2026-10-09'
    WHERE "status" = 'issued' AND "due_date" = '2026-10-09' AND "bank_due_date" IS NULL
      AND "description" ILIKE '%atrasada de agosto%'
      AND "company_id" IN (SELECT "id" FROM "console_companies" WHERE "name" ILIKE 'CC CAIEIRAS%')
    RETURNING "id"`);
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_invoices' AND column_name IN ('due_date', 'bank_due_date')`,
  );
  return Response.json({
    fixedInvoices: fixed.rows.map((r) => r.id),
    columns: columns.rows.map((r) => r.column_name),
  });
}
