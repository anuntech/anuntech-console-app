import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0023_bookmark_company_scope.sql; idempotent, remove after use. */
export async function GET() {
  await db.execute(sql`ALTER TABLE "console_bookmark_folders" ADD COLUMN IF NOT EXISTS "company_id" text`);
  await db.execute(
    sql`ALTER TABLE "console_bookmark_folders" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'company' NOT NULL`,
  );
  await db.execute(sql`ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "company_id" text`);
  const constraints = [
    [
      "console_bookmark_folders_company_id_console_companies_id_fk",
      sql`ALTER TABLE "console_bookmark_folders" ADD CONSTRAINT "console_bookmark_folders_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_bookmarks_company_id_console_companies_id_fk",
      sql`ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(statement);
    added.push(name);
  }
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_folder_company_idx" ON "console_bookmark_folders" USING btree ("company_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_company_idx" ON "console_bookmarks" USING btree ("company_id")`);
  const columns = await db.execute(
    sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('console_bookmarks','console_bookmark_folders') AND column_name IN ('company_id','visibility') ORDER BY table_name, column_name`,
  );
  return Response.json({ constraintsAdded: added, columns: columns.rows });
}
