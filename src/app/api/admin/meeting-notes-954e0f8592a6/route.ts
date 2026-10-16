import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the Mac meeting-notes app's connections and the
 * meeting details on bookmarks in production (drizzle/0044_meeting_notes),
 * before the code that reads them ships. Lists the columns and constraints it
 * finds afterwards. Removed in the deploy that brings the meeting notes.
 */
const TOKEN_SHA256 = "62abcdec2b1541f6d2b4b955d12e825f88ca549b1a408f014a022f04420d2220";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_app_connections\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"user_id\" text NOT NULL,\n\t\"app\" text NOT NULL,\n\t\"device\" text,\n\t\"challenge\" text,\n\t\"code_hash\" text,\n\t\"code_expires_at\" timestamp with time zone,\n\t\"token_hash\" text,\n\t\"connected_at\" timestamp with time zone,\n\t\"last_used_at\" timestamp with time zone,\n\t\"revoked_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"console_app_connections_code_hash_unique\" UNIQUE(\"code_hash\"),\n\tCONSTRAINT \"console_app_connections_token_hash_unique\" UNIQUE(\"token_hash\")\n);",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"meeting\" jsonb;",
  "DO $$ BEGIN ALTER TABLE \"console_app_connections\" ADD CONSTRAINT \"console_app_connections_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_app_connection_user_idx\" ON \"console_app_connections\" USING btree (\"user_id\");",
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select table_name, count(*)::int as columns
      from information_schema.columns
      where table_schema = 'public'
        and (table_name = 'console_app_connections' or (table_name = 'console_bookmarks' and column_name = 'meeting'))
      group by table_name
      order by table_name`)
  ).rows;
  const constraints = (
    await db.execute(sql`
      select conname from pg_constraint
      where conrelid = 'console_app_connections'::regclass
      order by conname`)
  ).rows.map((row) => (row as { conname: string }).conname);
  return Response.json({ ok: true, statements: STATEMENTS.length, columns, constraints });
}
