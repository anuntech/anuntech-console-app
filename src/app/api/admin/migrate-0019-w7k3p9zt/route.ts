import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * One-shot runner for drizzle/0019_task_labels_estimate_files.sql from inside
 * the Vercel runtime, where production DATABASE_URL exists. Idempotent;
 * remove after use.
 */
export async function GET() {
  await db.execute(sql`ALTER TABLE "console_attachments" ALTER COLUMN "ticket_id" DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE "console_attachments" ADD COLUMN IF NOT EXISTS "task_id" text`);
  await db.execute(
    sql`ALTER TABLE "console_tasks" ADD COLUMN IF NOT EXISTS "labels" text[] DEFAULT '{}' NOT NULL`,
  );
  await db.execute(sql`ALTER TABLE "console_tasks" ADD COLUMN IF NOT EXISTS "estimate_minutes" integer`);
  const existing = await db.execute(
    sql`SELECT 1 FROM pg_constraint WHERE conname = 'console_attachments_task_id_console_tasks_id_fk'`,
  );
  if (!existing.rowCount)
    await db.execute(
      sql`ALTER TABLE "console_attachments" ADD CONSTRAINT "console_attachments_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action`,
    );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "console_attachment_task_idx" ON "console_attachments" USING btree ("task_id")`,
  );
  const columns = await db.execute(
    sql`SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_name IN ('console_tasks', 'console_attachments') AND column_name IN ('labels', 'estimate_minutes', 'task_id', 'ticket_id') ORDER BY table_name, column_name`,
  );
  return Response.json({ columns: columns.rows, constraintAdded: !existing.rowCount });
}
