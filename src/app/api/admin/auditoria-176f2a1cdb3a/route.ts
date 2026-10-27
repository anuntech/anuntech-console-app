import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0055_auditoria_por_item.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "6d984331eb0ed8b192c04acf69d5984d1340fdf1f1253dd5f925baf2a635522a";
const STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS \"console_audit_entity_idx\" ON \"console_audit_events\" USING btree (\"entity_id\",\"created_at\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
