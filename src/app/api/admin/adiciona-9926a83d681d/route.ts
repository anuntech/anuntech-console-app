import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0056_arquivos_quem_adiciona.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "843785175df3225677600bb50f85f6b5d24c3563c03291715cad56058d932a2e";
const STATEMENTS = [
  "ALTER TABLE \"console_bookmark_folders\" ADD COLUMN IF NOT EXISTS \"adds\" text DEFAULT 'viewers' NOT NULL;"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
