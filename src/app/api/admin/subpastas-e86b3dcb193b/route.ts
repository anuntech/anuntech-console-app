import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0049_arquivos_subpastas.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "5183c61a221c8a5c4b899288b7ffdd7db65e6dad029881c8cc5b61ebddf70fa5";
const STATEMENTS = [
  "ALTER TABLE \"console_bookmark_folders\" ADD COLUMN IF NOT EXISTS \"parent_id\" text;",
  "DO $$ BEGIN ALTER TABLE \"console_bookmark_folders\" ADD CONSTRAINT \"console_bookmark_folders_parent_id_console_bookmark_folders_id_fk\" FOREIGN KEY (\"parent_id\") REFERENCES \"public\".\"console_bookmark_folders\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_bookmark_folder_parent_idx\" ON \"console_bookmark_folders\" USING btree (\"parent_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
