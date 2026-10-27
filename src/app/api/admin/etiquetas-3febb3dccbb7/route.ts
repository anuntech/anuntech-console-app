import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0053_arquivos_etiquetas.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "5ee784e6efda5bdefd8373e17c7f1127d94054f605667b9181f4abd3a0cc1373";
const STATEMENTS = [
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"tag\" text;",
  "ALTER TABLE \"console_bookmarks\" ADD COLUMN IF NOT EXISTS \"tag_source\" text;",
  "CREATE INDEX IF NOT EXISTS \"console_bookmark_tag_idx\" ON \"console_bookmarks\" USING btree (\"tag\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
