import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: the automation tables and links in production (drizzle/0038). Removed right after it runs. */
const TOKEN_SHA256 = "ba333745e0d524184d0b12e7efa3e28b015f419ebd520c89a2e850718eae3d18";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_automation_events\" (\"id\" text PRIMARY KEY NOT NULL, \"kind\" text NOT NULL, \"entity_id\" text NOT NULL, \"company_id\" text, \"actor_id\" text, \"details\" jsonb, \"created_at\" timestamp with time zone DEFAULT now() NOT NULL)",
  "CREATE TABLE IF NOT EXISTS \"console_cron_runs\" (\"name\" text PRIMARY KEY NOT NULL, \"last_ok_at\" timestamp with time zone, \"last_failed_at\" timestamp with time zone, \"last_error\" text, \"updated_at\" timestamp with time zone DEFAULT now() NOT NULL)",
  "ALTER TABLE \"console_contracts\" ADD COLUMN IF NOT EXISTS \"quote_id\" text",
  "ALTER TABLE \"console_engagements\" ADD COLUMN IF NOT EXISTS \"quote_id\" text",
  "ALTER TABLE \"console_environment_profile\" ADD COLUMN IF NOT EXISTS \"automations\" jsonb DEFAULT '{}'::jsonb NOT NULL",
  "ALTER TABLE \"console_invoices\" ADD COLUMN IF NOT EXISTS \"quote_id\" text",
  "ALTER TABLE \"console_quotes\" ADD COLUMN IF NOT EXISTS \"ticket_id\" text",
  "DO $$ BEGIN ALTER TABLE \"console_automation_events\" ADD CONSTRAINT \"console_automation_events_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_automation_events\" ADD CONSTRAINT \"console_automation_events_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_automation_event_unique\" ON \"console_automation_events\" USING btree (\"kind\",\"entity_id\")",
  "CREATE INDEX IF NOT EXISTS \"console_automation_event_company_idx\" ON \"console_automation_events\" USING btree (\"company_id\")",
  "DO $$ BEGIN ALTER TABLE \"console_contracts\" ADD CONSTRAINT \"console_contracts_quote_id_console_quotes_id_fk\" FOREIGN KEY (\"quote_id\") REFERENCES \"public\".\"console_quotes\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_engagements\" ADD CONSTRAINT \"console_engagements_quote_id_console_quotes_id_fk\" FOREIGN KEY (\"quote_id\") REFERENCES \"public\".\"console_quotes\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_invoices\" ADD CONSTRAINT \"console_invoices_quote_id_console_quotes_id_fk\" FOREIGN KEY (\"quote_id\") REFERENCES \"public\".\"console_quotes\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_quotes\" ADD CONSTRAINT \"console_quotes_ticket_id_console_tickets_id_fk\" FOREIGN KEY (\"ticket_id\") REFERENCES \"public\".\"console_tickets\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const rows = (
    await db.execute(sql`select count(*)::int as n from information_schema.columns where (table_name = 'console_automation_events') or (table_name = 'console_cron_runs') or (column_name = 'quote_id' and table_name in ('console_contracts', 'console_engagements', 'console_invoices')) or (table_name = 'console_quotes' and column_name = 'ticket_id') or (table_name = 'console_environment_profile' and column_name = 'automations')`)
  ).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: rows[0].n });
}
