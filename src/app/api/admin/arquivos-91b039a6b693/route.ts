import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: Arquivos' storage columns, the company quota and the
 * uploads table in production (drizzle/0047_arquivos_r2), before the code that
 * reads them ships. Lists what it finds afterwards. Removed in the deploy that
 * brings Arquivos.
 */
const TOKEN_SHA256 = "417930e0c52f2227b70902f54b833c1e157c1c6ce3dce621260c1e3892709dac";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_file_uploads\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"actor_id\" text NOT NULL,\n\t\"company_id\" text,\n\t\"folder_id\" text,\n\t\"file_name\" text NOT NULL,\n\t\"mime\" text,\n\t\"size\" bigint NOT NULL,\n\t\"part_size\" integer NOT NULL,\n\t\"storage_key\" text NOT NULL,\n\t\"multipart_id\" text NOT NULL,\n\t\"status\" text DEFAULT 'uploading' NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"storage_key\" text;",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"file_size\" bigint;",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"mime\" text;",
  "ALTER TABLE \"console_companies\" ADD COLUMN IF NOT EXISTS \"storage_quota_bytes\" bigint;",
  "DO $$ BEGIN ALTER TABLE \"console_file_uploads\" ADD CONSTRAINT \"console_file_uploads_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_file_uploads\" ADD CONSTRAINT \"console_file_uploads_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_file_uploads\" ADD CONSTRAINT \"console_file_uploads_folder_id_console_bookmark_folders_id_fk\" FOREIGN KEY (\"folder_id\") REFERENCES \"public\".\"console_bookmark_folders\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_file_upload_company_idx\" ON \"console_file_uploads\" USING btree (\"company_id\");",
  "CREATE INDEX IF NOT EXISTS \"console_file_upload_actor_idx\" ON \"console_file_uploads\" USING btree (\"actor_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and ((table_name = 'console_bookmarks' and column_name in ('storage_key', 'file_size', 'mime'))
          or (table_name = 'console_companies' and column_name = 'storage_quota_bytes')
          or table_name = 'console_file_uploads')
      order by table_name, column_name`)
  ).rows;
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: columns.length, uploadsTable: columns.filter((c) => (c as { table_name: string }).table_name === "console_file_uploads").length });
}
