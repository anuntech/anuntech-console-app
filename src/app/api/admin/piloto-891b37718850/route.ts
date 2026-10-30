import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0058_piloto_automatico.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "3f32dc44ffe9afd136f402364c1450a9e75cb722f6f77dc22d104ee63fc42791";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_events\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"type\" text NOT NULL,\n\t\"key\" text NOT NULL,\n\t\"company_id\" text,\n\t\"entity_id\" text NOT NULL,\n\t\"payload\" jsonb DEFAULT '{}'::jsonb NOT NULL,\n\t\"occurred_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"processed_at\" timestamp with time zone,\n\t\"attempts\" integer DEFAULT 0 NOT NULL,\n\t\"last_error\" text\n);",
  "CREATE TABLE IF NOT EXISTS \"console_decisions\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"kind\" text NOT NULL,\n\t\"entity_id\" text NOT NULL,\n\t\"company_id\" text,\n\t\"event_id\" text,\n\t\"title\" text NOT NULL,\n\t\"reason\" text NOT NULL,\n\t\"details\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"steps\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"draft\" text,\n\t\"level\" integer DEFAULT 1 NOT NULL,\n\t\"status\" text DEFAULT 'pending' NOT NULL,\n\t\"resolution\" text,\n\t\"dismiss_reason\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"decided_by\" text,\n\t\"decided_at\" timestamp with time zone\n);",
  "DO $$ BEGIN ALTER TABLE \"console_events\" ADD CONSTRAINT \"console_events_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_decisions\" ADD CONSTRAINT \"console_decisions_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_decisions\" ADD CONSTRAINT \"console_decisions_event_id_console_events_id_fk\" FOREIGN KEY (\"event_id\") REFERENCES \"public\".\"console_events\"(\"id\") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_decisions\" ADD CONSTRAINT \"console_decisions_decided_by_console_user_id_fk\" FOREIGN KEY (\"decided_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_event_key_unique\" ON \"console_events\" USING btree (\"key\");",
  "CREATE INDEX IF NOT EXISTS \"console_event_pending_idx\" ON \"console_events\" USING btree (\"processed_at\",\"occurred_at\");",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_decision_unique\" ON \"console_decisions\" USING btree (\"kind\",\"entity_id\");",
  "CREATE INDEX IF NOT EXISTS \"console_decision_status_idx\" ON \"console_decisions\" USING btree (\"status\",\"created_at\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
