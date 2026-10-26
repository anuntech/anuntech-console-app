import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the trash columns of Arquivos (drizzle/0048_arquivos_lixeira)
 * in production, before the code that reads them ships. Removed in the deploy that
 * brings the trash.
 */
const TOKEN_SHA256 = "6c07aebb8a9a353153e7ddcf6f13ceea0db8b34a24886d33806250ea39642df3";
const STATEMENTS = [
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"deleted_at\" timestamp with time zone;",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"deleted_by\" text;",
  "DO $$ BEGIN ALTER TABLE \"console_bookmarks\" ADD CONSTRAINT \"console_bookmarks_deleted_by_console_user_id_fk\" FOREIGN KEY (\"deleted_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_bookmark_deleted_idx\" ON \"console_bookmarks\" USING btree (\"deleted_at\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`select column_name from information_schema.columns where table_name = 'console_bookmarks' and column_name in ('deleted_at', 'deleted_by') order by column_name`)
  ).rows.map((row) => (row as { column_name: string }).column_name);
  return Response.json({ ok: columns.length === 2, statements: STATEMENTS.length, columns });
}
