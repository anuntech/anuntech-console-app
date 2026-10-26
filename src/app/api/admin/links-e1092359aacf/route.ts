import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0051_arquivos_links.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "e23a123414267b538f3a3847314296a7e2792d78de0316a7f0470e1c88c82fa4";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_share_links\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"kind\" text NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"company_id\" text,\n\t\"folder_id\" text,\n\t\"bookmark_id\" text,\n\t\"title\" text NOT NULL,\n\t\"password_hash\" text,\n\t\"expires_at\" timestamp with time zone,\n\t\"max_downloads\" integer,\n\t\"downloads\" integer DEFAULT 0 NOT NULL,\n\t\"uploads\" integer DEFAULT 0 NOT NULL,\n\t\"created_by\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_used_at\" timestamp with time zone,\n\t\"revoked_at\" timestamp with time zone,\n\tCONSTRAINT \"console_share_links_token_hash_unique\" UNIQUE(\"token_hash\")\n);",
  "ALTER TABLE \"console_file_uploads\" ADD COLUMN IF NOT EXISTS \"share_link_id\" text;",
  "ALTER TABLE \"console_file_uploads\" ADD COLUMN IF NOT EXISTS \"visitor_secret_hash\" text;",
  "ALTER TABLE \"console_file_uploads\" ADD COLUMN IF NOT EXISTS \"sender_name\" text;",
  "DO $$ BEGIN ALTER TABLE \"console_share_links\" ADD CONSTRAINT \"console_share_links_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_share_links\" ADD CONSTRAINT \"console_share_links_folder_id_console_bookmark_folders_id_fk\" FOREIGN KEY (\"folder_id\") REFERENCES \"public\".\"console_bookmark_folders\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_share_links\" ADD CONSTRAINT \"console_share_links_bookmark_id_console_bookmarks_id_fk\" FOREIGN KEY (\"bookmark_id\") REFERENCES \"public\".\"console_bookmarks\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_share_links\" ADD CONSTRAINT \"console_share_links_created_by_console_user_id_fk\" FOREIGN KEY (\"created_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_share_link_folder_idx\" ON \"console_share_links\" USING btree (\"folder_id\");",
  "CREATE INDEX IF NOT EXISTS \"console_share_link_bookmark_idx\" ON \"console_share_links\" USING btree (\"bookmark_id\");",
  "DO $$ BEGIN ALTER TABLE \"console_file_uploads\" ADD CONSTRAINT \"console_file_uploads_share_link_id_console_share_links_id_fk\" FOREIGN KEY (\"share_link_id\") REFERENCES \"public\".\"console_share_links\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
