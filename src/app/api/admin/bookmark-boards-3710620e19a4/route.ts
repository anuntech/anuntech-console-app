import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: the whiteboard columns of console_bookmarks in production (drizzle/0040). Removed right after it runs. */
const TOKEN_SHA256 = "920a5b9c5010cb994ebe3a056f86bb8878f9a2001aec6c10c184d99436a71493";
const STATEMENTS = [
  'ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "board" jsonb',
  'ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "preview" bytea',
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const rows = (
    await db.execute(
      sql`select string_agg(column_name, ',' order by ordinal_position) as columns from information_schema.columns where table_name = 'console_bookmarks'`,
    )
  ).rows as { columns: string }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: rows[0].columns });
}
