import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: adds the service terms, milestones, hours bank and ticket clock columns in production (drizzle/0036). Removed right after it runs. */
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_hours_months\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"month\" text NOT NULL,\n\t\"overage_approved_minutes\" integer DEFAULT 0 NOT NULL,\n\t\"overage_approved_by\" text,\n\t\"overage_approved_at\" timestamp with time zone,\n\t\"report_sent_at\" timestamp with time zone,\n\t\"report_sent_by\" text,\n\t\"contested_at\" timestamp with time zone,\n\t\"contested_by\" text,\n\t\"contest_note\" text,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"console_service_terms\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"engagement_id\" text,\n\t\"basis\" text NOT NULL,\n\t\"preset\" text NOT NULL,\n\t\"label\" text NOT NULL,\n\t\"contract_id\" text,\n\t\"policy\" jsonb NOT NULL,\n\t\"person_client\" boolean DEFAULT false NOT NULL,\n\t\"publish_at\" timestamp with time zone,\n\t\"verified_by\" text,\n\t\"verified_at\" timestamp with time zone,\n\t\"version\" integer DEFAULT 1 NOT NULL,\n\t\"active\" boolean DEFAULT true NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"console_time_entries\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"ticket_id\" text,\n\t\"engagement_id\" text,\n\t\"author_id\" text NOT NULL,\n\t\"minutes\" integer NOT NULL,\n\t\"note\" text NOT NULL,\n\t\"worked_on\" date NOT NULL,\n\t\"kind\" text DEFAULT 'bank' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS \"console_user_milestones\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"user_id\" text NOT NULL,\n\t\"company_id\" text DEFAULT '' NOT NULL,\n\t\"key\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n)",
  "ALTER TABLE \"console_environment_profile\" ADD COLUMN IF NOT EXISTS \"holidays\" jsonb DEFAULT '{}'::jsonb NOT NULL",
  "ALTER TABLE \"console_tasks\" ADD COLUMN IF NOT EXISTS \"requested\" boolean DEFAULT false NOT NULL",
  "ALTER TABLE \"console_tasks\" ADD COLUMN IF NOT EXISTS \"review_since\" timestamp with time zone",
  "ALTER TABLE \"console_tasks\" ADD COLUMN IF NOT EXISTS \"approved_by\" text",
  "ALTER TABLE \"console_tasks\" ADD COLUMN IF NOT EXISTS \"approved_at\" timestamp with time zone",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"kind\" text",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"impact\" text",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"channel\" text DEFAULT 'console' NOT NULL",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"waiting_for\" text",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"waiting_since\" timestamp with time zone",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"paused_minutes\" integer DEFAULT 0 NOT NULL",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"first_response_at\" timestamp with time zone",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"response_due_at\" timestamp with time zone",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"resolution_due_at\" timestamp with time zone",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"terms\" jsonb",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"estimate_minutes\" integer",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"estimate_status\" text",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"estimate_decided_by\" text",
  "ALTER TABLE \"console_tickets\" ADD COLUMN IF NOT EXISTS \"estimate_decided_at\" timestamp with time zone",
  "DO $$ BEGIN ALTER TABLE \"console_hours_months\" ADD CONSTRAINT \"console_hours_months_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_hours_months\" ADD CONSTRAINT \"console_hours_months_overage_approved_by_console_user_id_fk\" FOREIGN KEY (\"overage_approved_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_hours_months\" ADD CONSTRAINT \"console_hours_months_report_sent_by_console_user_id_fk\" FOREIGN KEY (\"report_sent_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_hours_months\" ADD CONSTRAINT \"console_hours_months_contested_by_console_user_id_fk\" FOREIGN KEY (\"contested_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_service_terms\" ADD CONSTRAINT \"console_service_terms_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_service_terms\" ADD CONSTRAINT \"console_service_terms_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_service_terms\" ADD CONSTRAINT \"console_service_terms_contract_id_console_contracts_id_fk\" FOREIGN KEY (\"contract_id\") REFERENCES \"public\".\"console_contracts\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_service_terms\" ADD CONSTRAINT \"console_service_terms_verified_by_console_user_id_fk\" FOREIGN KEY (\"verified_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_time_entries\" ADD CONSTRAINT \"console_time_entries_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_time_entries\" ADD CONSTRAINT \"console_time_entries_ticket_id_console_tickets_id_fk\" FOREIGN KEY (\"ticket_id\") REFERENCES \"public\".\"console_tickets\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_time_entries\" ADD CONSTRAINT \"console_time_entries_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_time_entries\" ADD CONSTRAINT \"console_time_entries_author_id_console_user_id_fk\" FOREIGN KEY (\"author_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_user_milestones\" ADD CONSTRAINT \"console_user_milestones_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_hours_month_unique\" ON \"console_hours_months\" USING btree (\"company_id\",\"month\")",
  "CREATE INDEX IF NOT EXISTS \"console_service_terms_company_idx\" ON \"console_service_terms\" USING btree (\"company_id\")",
  "CREATE INDEX IF NOT EXISTS \"console_time_entry_company_idx\" ON \"console_time_entries\" USING btree (\"company_id\",\"worked_on\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_user_milestone_unique\" ON \"console_user_milestones\" USING btree (\"user_id\",\"company_id\",\"key\")",
  "DO $$ BEGIN ALTER TABLE \"console_tasks\" ADD CONSTRAINT \"console_tasks_approved_by_console_user_id_fk\" FOREIGN KEY (\"approved_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_tickets\" ADD CONSTRAINT \"console_tickets_estimate_decided_by_console_user_id_fk\" FOREIGN KEY (\"estimate_decided_by\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "eabd0baa33dd71340e72cfbb") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`select count(*)::int as n from information_schema.columns where table_name in ('console_service_terms', 'console_user_milestones', 'console_time_entries', 'console_hours_months') or (table_name = 'console_tickets' and column_name in ('kind', 'terms', 'response_due_at', 'estimate_decided_at'))`)
  ).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: columns[0].n });
}
