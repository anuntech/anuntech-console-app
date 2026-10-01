import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: creates the contract change requests table in production (drizzle/0035). Removed right after it runs. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "console_contract_change_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "contract_id" text NOT NULL,
    "version" integer NOT NULL,
    "block_index" integer NOT NULL,
    "label" text NOT NULL,
    "excerpt" text NOT NULL,
    "comment" text NOT NULL,
    "proposed_text" text,
    "status" text DEFAULT 'draft' NOT NULL,
    "applied" boolean DEFAULT false NOT NULL,
    "response" text,
    "author_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "submitted_at" timestamp with time zone,
    "decided_by" text,
    "decided_at" timestamp with time zone
  )`,
  `DO $$ BEGIN ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_decided_by_console_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE INDEX IF NOT EXISTS "console_contract_change_contract_idx" ON "console_contract_change_requests" USING btree ("contract_id","version")`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "f90eaf4d189c5eddc2df2e82") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const columns = (
    await db.execute(sql`select count(*)::int as n from information_schema.columns where table_name = 'console_contract_change_requests'`)
  ).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, columns: columns[0].n });
}
