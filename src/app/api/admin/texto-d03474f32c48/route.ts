import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0052_arquivos_texto.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "be76dc7a11a0fe6db11d296f94873b228e9464d5ea10dece6d3cab7a809850cd";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_file_texts\" (\n\t\"bookmark_id\" text PRIMARY KEY NOT NULL,\n\t\"source_key\" text NOT NULL,\n\t\"status\" text NOT NULL,\n\t\"text\" text,\n\t\"reason\" text,\n\t\"attempts\" integer DEFAULT 0 NOT NULL,\n\t\"search\" \"tsvector\" GENERATED ALWAYS AS (to_tsvector('portuguese'::regconfig, lower(translate(coalesce(\"text\", ''), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY')))) STORED,\n\t\"extracted_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "DO $$ BEGIN ALTER TABLE \"console_file_texts\" ADD CONSTRAINT \"console_file_texts_bookmark_id_console_bookmarks_id_fk\" FOREIGN KEY (\"bookmark_id\") REFERENCES \"public\".\"console_bookmarks\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_file_text_search_idx\" ON \"console_file_texts\" USING gin (\"search\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
