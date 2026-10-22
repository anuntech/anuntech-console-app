import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: the push queue table in production
 * (drizzle/0046_push_notices), before the code that writes it ships (replies,
 * invoices, contracts, quotes and deliveries enqueue phone notices). Lists
 * what it finds afterwards. Removed in the deploy that brings the push queue.
 */
const TOKEN_SHA256 = "106188f52dac58c12b3007cc29811e8dca63ba2cb12019d76611ee520757adea";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_push_notices\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"event_key\" text NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"user_id\" text NOT NULL,\n\t\"device_id\" text NOT NULL,\n\t\"topic\" text NOT NULL,\n\t\"entity_type\" text NOT NULL,\n\t\"entity_id\" text NOT NULL,\n\t\"audience\" text NOT NULL,\n\t\"payload\" jsonb NOT NULL,\n\t\"status\" text DEFAULT 'pending' NOT NULL,\n\t\"attempts\" integer DEFAULT 0 NOT NULL,\n\t\"next_attempt_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"locked_at\" timestamp with time zone,\n\t\"provider_id\" text,\n\t\"provider_status\" text,\n\t\"error\" text,\n\t\"receipt_checked_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
  "DO $$ BEGIN ALTER TABLE \"console_push_notices\" ADD CONSTRAINT \"console_push_notices_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_push_notices\" ADD CONSTRAINT \"console_push_notices_user_id_console_user_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_push_notices\" ADD CONSTRAINT \"console_push_notices_device_id_console_push_devices_id_fk\" FOREIGN KEY (\"device_id\") REFERENCES \"public\".\"console_push_devices\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_push_notices_event_device_unique\" ON \"console_push_notices\" USING btree (\"event_key\",\"device_id\");",
  "CREATE INDEX IF NOT EXISTS \"console_push_notices_pending_idx\" ON \"console_push_notices\" USING btree (\"status\",\"next_attempt_at\");",
  "CREATE INDEX IF NOT EXISTS \"console_push_notices_company_idx\" ON \"console_push_notices\" USING btree (\"company_id\");"
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`
      select count(*)::int as columns
      from information_schema.columns
      where table_schema = 'public' and table_name = 'console_push_notices'`)
  ).rows;
  const indexes = (
    await db.execute(sql`select indexname from pg_indexes where tablename = 'console_push_notices' order by indexname`)
  ).rows.map((row) => (row as { indexname: string }).indexname);
  return Response.json({ ok: true, statements: STATEMENTS.length, columns, indexes });
}
