import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the push devices table in production
 * (drizzle/0045_push_devices), before the code that writes it ships (account
 * deletion disables a person's phones). Lists what it finds afterwards.
 * Removed in the deploy that brings the native app's server side.
 */
const TOKEN_SHA256 = "6c5fc25925ecb87e44dd6dc7ae02053d3978d1055147de789f110299174c5862";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_push_devices\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"user_id\" text NOT NULL,\n\t\"platform\" text NOT NULL,\n\t\"token\" text NOT NULL,\n\t\"app_version\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_seen_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"disabled_at\" timestamp with time zone\n);",
  "DO $$ BEGIN ALTER TABLE \"console_push_devices\" ADD CONSTRAINT \"console_push_devices_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_push_devices_token_unique\" ON \"console_push_devices\" USING btree (\"token\");",
  "CREATE INDEX IF NOT EXISTS \"console_push_devices_user_idx\" ON \"console_push_devices\" USING btree (\"user_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select count(*)::int as columns
      from information_schema.columns
      where table_schema = 'public' and table_name = 'console_push_devices'`)
  ).rows;
  const indexes = (
    await db.execute(sql`select indexname from pg_indexes where tablename = 'console_push_devices' order by indexname`)
  ).rows.map((row) => (row as { indexname: string }).indexname);
  return Response.json({ ok: true, statements: STATEMENTS.length, columns, indexes });
}
