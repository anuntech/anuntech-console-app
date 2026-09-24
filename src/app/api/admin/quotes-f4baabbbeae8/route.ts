import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: creates the quotes tables in production
 * (drizzle/0029_quotes.sql). Removed right after it runs.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "console_quote_versions" (
    "id" text PRIMARY KEY NOT NULL,
    "quote_id" text NOT NULL,
    "version" integer NOT NULL,
    "publication" jsonb NOT NULL,
    "document_hash" text NOT NULL,
    "sent_by" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "console_quotes" (
    "id" text PRIMARY KEY NOT NULL,
    "company_id" text NOT NULL,
    "year" integer NOT NULL,
    "seq" integer NOT NULL,
    "title" text NOT NULL,
    "content" jsonb NOT NULL,
    "valid_until" date,
    "revision" integer DEFAULT 1 NOT NULL,
    "status" text DEFAULT 'draft' NOT NULL,
    "publication" jsonb,
    "published_version" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone,
    "document_hash" text,
    "decided_at" timestamp with time zone,
    "decided_by" text,
    "decided_party" text,
    "decided_name" text,
    "decided_email" text,
    "decided_ip" text,
    "decision_note" text,
    "author_id" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `DO $$ BEGIN
    ALTER TABLE "console_quote_versions" ADD CONSTRAINT "console_quote_versions_quote_id_console_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."console_quotes"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_quote_versions" ADD CONSTRAINT "console_quote_versions_sent_by_console_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_quotes" ADD CONSTRAINT "console_quotes_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_quotes" ADD CONSTRAINT "console_quotes_decided_by_console_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_quotes" ADD CONSTRAINT "console_quotes_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "console_quote_version_unique" ON "console_quote_versions" USING btree ("quote_id","version")`,
  `CREATE INDEX IF NOT EXISTS "console_quote_company_idx" ON "console_quotes" USING btree ("company_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "console_quote_number_unique" ON "console_quotes" USING btree ("year","seq")`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "f4baabbbeae8a5ff5cc4c23a") return new Response(null, { status: 404 });
  const done: string[] = [];
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
    done.push(statement.slice(0, 60).replace(/\s+/g, " "));
  }
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_quotes`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: done.length, quotes: n });
}
