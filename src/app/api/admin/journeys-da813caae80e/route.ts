import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: the project journey tables in production (drizzle/0039). Removed right after it runs. */
const TOKEN_SHA256 = "18f3d35fe3c3bd77cdb4aa766a22b4e8ca7f728181d53c8bfe9fb04830ddea8f";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_journey_steps\" ( \"id\" text PRIMARY KEY NOT NULL, \"journey_id\" text NOT NULL, \"key\" text NOT NULL, \"title\" text, \"stage\" text, \"status\" text DEFAULT 'todo' NOT NULL, \"note\" text, \"url\" text, \"value\" text, \"scheduled_at\" timestamp with time zone, \"assignee_id\" text, \"done_by\" text, \"done_at\" timestamp with time zone, \"ai_draft\" jsonb, \"updated_at\" timestamp with time zone DEFAULT now() NOT NULL, \"created_at\" timestamp with time zone DEFAULT now() NOT NULL )",
  "CREATE TABLE IF NOT EXISTS \"console_journeys\" ( \"id\" text PRIMARY KEY NOT NULL, \"title\" text NOT NULL, \"company_id\" text, \"lead\" jsonb, \"ticket_id\" text, \"quote_id\" text, \"engagement_id\" text, \"hosting_engagement_id\" text, \"owner_id\" text, \"template\" text DEFAULT 'projeto-v1' NOT NULL, \"status\" text DEFAULT 'active' NOT NULL, \"briefing\" jsonb, \"finished_at\" timestamp with time zone, \"updated_at\" timestamp with time zone DEFAULT now() NOT NULL, \"created_at\" timestamp with time zone DEFAULT now() NOT NULL )",
  "DO $$ BEGIN ALTER TABLE \"console_journey_steps\" ADD CONSTRAINT \"console_journey_steps_journey_id_console_journeys_id_fk\" FOREIGN KEY (\"journey_id\") REFERENCES \"public\".\"console_journeys\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journey_steps\" ADD CONSTRAINT \"console_journey_steps_assignee_id_console_user_id_fk\" FOREIGN KEY (\"assignee_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journey_steps\" ADD CONSTRAINT \"console_journey_steps_done_by_console_user_id_fk\" FOREIGN KEY (\"done_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_ticket_id_console_tickets_id_fk\" FOREIGN KEY (\"ticket_id\") REFERENCES \"public\".\"console_tickets\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_quote_id_console_quotes_id_fk\" FOREIGN KEY (\"quote_id\") REFERENCES \"public\".\"console_quotes\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_hosting_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"hosting_engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_journeys\" ADD CONSTRAINT \"console_journeys_owner_id_console_user_id_fk\" FOREIGN KEY (\"owner_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_journey_steps_unique\" ON \"console_journey_steps\" USING btree (\"journey_id\",\"key\")",
  "CREATE INDEX IF NOT EXISTS \"console_journeys_company_idx\" ON \"console_journeys\" USING btree (\"company_id\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_journeys_quote_unique\" ON \"console_journeys\" USING btree (\"quote_id\")"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const rows = (
    await db.execute(sql`select count(*)::int as n from information_schema.columns where table_name in ('console_journeys', 'console_journey_steps')`)
  ).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: rows[0].n });
}
