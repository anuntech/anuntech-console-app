import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0050_arquivos_versoes.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "46d45b8a43aa65a622c3c037fa8a9051fd4325343ccc25a728b059df162e02fe";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_file_versions\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"bookmark_id\" text NOT NULL,\n\t\"company_id\" text,\n\t\"version\" integer NOT NULL,\n\t\"file_name\" text NOT NULL,\n\t\"file_size\" bigint NOT NULL,\n\t\"mime\" text,\n\t\"storage_key\" text NOT NULL,\n\t\"actor_id\" text,\n\t\"created_at\" timestamp with time zone NOT NULL\n);",
  "DO $$ BEGIN ALTER TABLE \"console_file_versions\" ADD CONSTRAINT \"console_file_versions_bookmark_id_console_bookmarks_id_fk\" FOREIGN KEY (\"bookmark_id\") REFERENCES \"public\".\"console_bookmarks\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_file_versions\" ADD CONSTRAINT \"console_file_versions_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_file_versions\" ADD CONSTRAINT \"console_file_versions_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_file_version_unique\" ON \"console_file_versions\" USING btree (\"bookmark_id\",\"version\");",
  "CREATE INDEX IF NOT EXISTS \"console_file_version_company_idx\" ON \"console_file_versions\" USING btree (\"company_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
