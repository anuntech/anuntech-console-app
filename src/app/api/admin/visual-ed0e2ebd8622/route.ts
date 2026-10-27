import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0057_arquivos_visual.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "97b4f9bd32efef6f92c3c1c5b38afadbd68b03161a928acae2162ad08d0d85a5";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_bookmark_stars\" (\n\t\"user_id\" text NOT NULL,\n\t\"bookmark_id\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"console_bookmark_stars_user_id_bookmark_id_pk\" PRIMARY KEY(\"user_id\",\"bookmark_id\")\n);",
  "ALTER TABLE \"console_file_texts\" ADD COLUMN IF NOT EXISTS \"thumb_status\" text;",
  "DO $$ BEGIN ALTER TABLE \"console_bookmark_stars\" ADD CONSTRAINT \"console_bookmark_stars_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_bookmark_stars\" ADD CONSTRAINT \"console_bookmark_stars_bookmark_id_console_bookmarks_id_fk\" FOREIGN KEY (\"bookmark_id\") REFERENCES \"public\".\"console_bookmarks\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_bookmark_star_item_idx\" ON \"console_bookmark_stars\" USING btree (\"bookmark_id\");",
  "CREATE INDEX IF NOT EXISTS \"console_audit_actor_idx\" ON \"console_audit_events\" USING btree (\"actor_id\",\"created_at\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
