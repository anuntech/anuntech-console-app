import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * One-shot runner for drizzle/0021_bookmark_folders.sql from inside the
 * Vercel runtime, where production DATABASE_URL exists. Idempotent; remove
 * after use.
 */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_bookmark_folders" (
      "id" text PRIMARY KEY NOT NULL,
      "owner_id" text NOT NULL,
      "name" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_bookmark_folder_shares" (
      "folder_id" text NOT NULL,
      "user_id" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "console_bookmark_folder_shares_folder_id_user_id_pk" PRIMARY KEY("folder_id","user_id")
    )`);
  await db.execute(sql`ALTER TABLE "console_bookmarks" DROP CONSTRAINT IF EXISTS "console_bookmarks_company_id_console_companies_id_fk"`);
  await db.execute(sql`ALTER TABLE "console_bookmarks" DROP CONSTRAINT IF EXISTS "console_bookmarks_engagement_id_console_engagements_id_fk"`);
  await db.execute(sql`DROP INDEX IF EXISTS "console_bookmark_company_idx"`);
  await db.execute(sql`ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "folder_id" text`);
  await db.execute(
    sql`ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL`,
  );
  const constraints = [
    [
      "console_bookmark_folder_shares_folder_id_console_bookmark_folders_id_fk",
      sql`ALTER TABLE "console_bookmark_folder_shares" ADD CONSTRAINT "console_bookmark_folder_shares_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_bookmark_folder_shares_user_id_console_user_id_fk",
      sql`ALTER TABLE "console_bookmark_folder_shares" ADD CONSTRAINT "console_bookmark_folder_shares_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_bookmark_folders_owner_id_console_user_id_fk",
      sql`ALTER TABLE "console_bookmark_folders" ADD CONSTRAINT "console_bookmark_folders_owner_id_console_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_bookmarks_folder_id_console_bookmark_folders_id_fk",
      sql`ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(statement);
    added.push(name);
  }
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_share_user_idx" ON "console_bookmark_folder_shares" USING btree ("user_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_folder_owner_idx" ON "console_bookmark_folders" USING btree ("owner_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_owner_idx" ON "console_bookmarks" USING btree ("author_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_bookmark_folder_idx" ON "console_bookmarks" USING btree ("folder_id")`);
  await db.execute(sql`ALTER TABLE "console_bookmarks" DROP COLUMN IF EXISTS "company_id"`);
  await db.execute(sql`ALTER TABLE "console_bookmarks" DROP COLUMN IF EXISTS "engagement_id"`);
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_bookmarks' ORDER BY ordinal_position`,
  );
  return Response.json({
    constraintsAdded: added,
    bookmarkColumns: columns.rows.map((row) => row.column_name),
  });
}
