import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the assistant's confirmation cards and daily usage in
 * production (drizzle/0043_assistant_guardrails), before the code that reads
 * them ships. Lists the tables, columns and constraints it finds afterwards.
 * Removed in the deploy that brings the assistant guardrails.
 */
const TOKEN_SHA256 = "b4fe4e2fc2daf66c83b4ba36575efd3752dced05096c1ba12e2b63d1184fb2cf";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_assistant_proposals\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"user_id\" text NOT NULL,\n\t\"conversation_id\" text,\n\t\"tool\" text NOT NULL,\n\t\"args\" jsonb NOT NULL,\n\t\"args_hash\" text NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"details\" jsonb NOT NULL,\n\t\"nonce_hash\" text NOT NULL,\n\t\"status\" text DEFAULT 'pending' NOT NULL,\n\t\"tainted\" boolean DEFAULT false NOT NULL,\n\t\"path\" text,\n\t\"result\" jsonb,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"decided_at\" timestamp with time zone\n);",
  "CREATE TABLE IF NOT EXISTS \"console_assistant_usage\" (\n\t\"kind\" text NOT NULL,\n\t\"subject_id\" text NOT NULL,\n\t\"day\" date NOT NULL,\n\t\"tokens\" integer DEFAULT 0 NOT NULL,\n\t\"messages\" integer DEFAULT 0 NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"console_assistant_usage_kind_subject_id_day_pk\" PRIMARY KEY(\"kind\",\"subject_id\",\"day\")\n);",
  "DO $$ BEGIN ALTER TABLE \"console_assistant_proposals\" ADD CONSTRAINT \"console_assistant_proposals_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_assistant_proposals\" ADD CONSTRAINT \"console_assistant_proposals_conversation_id_console_assistant_conversations_id_fk\" FOREIGN KEY (\"conversation_id\") REFERENCES \"public\".\"console_assistant_conversations\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_assistant_proposal_user_idx\" ON \"console_assistant_proposals\" USING btree (\"user_id\",\"created_at\");",
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select table_name, count(*)::int as columns
      from information_schema.columns
      where table_schema = 'public' and table_name in ('console_assistant_proposals', 'console_assistant_usage')
      group by table_name
      order by table_name`)
  ).rows;
  const constraints = (
    await db.execute(sql`
      select conname from pg_constraint
      where conrelid in ('console_assistant_proposals'::regclass, 'console_assistant_usage'::regclass)
      order by conname`)
  ).rows.map((row) => (row as { conname: string }).conname);
  return Response.json({ ok: true, statements: STATEMENTS.length, columns, constraints });
}
