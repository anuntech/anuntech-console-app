import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0054_arquivos_console.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "c7e7c9c4cfa74b739f5bb63c050fe69d10bb80180735674ed238611d9b6b8b4a";
const STATEMENTS = [
  "ALTER TABLE \"console_bookmark_folders\" ADD COLUMN IF NOT EXISTS \"origin\" text;",
  "ALTER TABLE \"console_bookmark_folders\" ADD COLUMN IF NOT EXISTS \"area\" text;",
  "ALTER TABLE \"console_bookmark_folders\" ADD COLUMN IF NOT EXISTS \"engagement_id\" text;",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"origin\" text;",
  "DO $$ BEGIN ALTER TABLE \"console_bookmark_folders\" ADD CONSTRAINT \"console_bookmark_folders_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_bookmark_folder_origin_idx\" ON \"console_bookmark_folders\" USING btree (\"company_id\",\"origin\") WHERE \"console_bookmark_folders\".\"origin\" is not null;",
  "CREATE INDEX IF NOT EXISTS \"console_bookmark_folder_engagement_idx\" ON \"console_bookmark_folders\" USING btree (\"engagement_id\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_bookmark_origin_idx\" ON \"console_bookmarks\" USING btree (\"origin\") WHERE \"console_bookmarks\".\"origin\" is not null;"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
