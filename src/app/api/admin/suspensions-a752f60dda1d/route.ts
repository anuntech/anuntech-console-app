import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the suspension history table and the catalog's
 * suspension kind in production (drizzle/0044_engagement_suspensions), before
 * the code that reads them ships. Lists what it finds afterwards. Removed in
 * the deploy that brings the suspensions.
 */
const TOKEN_SHA256 = "90403fd21024426b6978cc36f127cbabb81c08a6525e0ce401a90e3562c3c63b";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_engagement_suspensions\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"engagement_id\" text NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"reason\" text NOT NULL,\n\t\"note\" text,\n\t\"scheduled_for\" date,\n\t\"notice_sent_at\" timestamp with time zone,\n\t\"suspended_at\" timestamp with time zone,\n\t\"settled_at\" timestamp with time zone,\n\t\"lifted_at\" timestamp with time zone,\n\t\"lift_reason\" text,\n\t\"lift_note\" text,\n\t\"steps\" jsonb DEFAULT '{}'::jsonb NOT NULL,\n\t\"actor_id\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "ALTER TABLE \"console_catalog_items\" ADD COLUMN IF NOT EXISTS \"suspension_kind\" text DEFAULT 'manual' NOT NULL;",
  "DO $$ BEGIN ALTER TABLE \"console_engagement_suspensions\" ADD CONSTRAINT \"console_engagement_suspensions_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_engagement_suspensions\" ADD CONSTRAINT \"console_engagement_suspensions_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_engagement_suspensions\" ADD CONSTRAINT \"console_engagement_suspensions_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_engagement_suspension_open_unique\" ON \"console_engagement_suspensions\" USING btree (\"engagement_id\") WHERE \"console_engagement_suspensions\".\"lifted_at\" is null;",
  "CREATE INDEX IF NOT EXISTS \"console_engagement_suspension_company_idx\" ON \"console_engagement_suspensions\" USING btree (\"company_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select table_name, count(*)::int as columns
      from information_schema.columns
      where table_schema = 'public'
        and (table_name = 'console_engagement_suspensions' or (table_name = 'console_catalog_items' and column_name = 'suspension_kind'))
      group by table_name
      order by table_name`)
  ).rows;
  const indexes = (
    await db.execute(sql`select indexname from pg_indexes where tablename = 'console_engagement_suspensions' order by indexname`)
  ).rows.map((row) => (row as { indexname: string }).indexname);
  return Response.json({ ok: true, statements: STATEMENTS.length, columns, indexes });
}
