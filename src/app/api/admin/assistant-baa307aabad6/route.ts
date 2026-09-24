import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: creates the assistant tables in production
 * (drizzle/0030_assistant.sql). Removed right after it runs.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "console_assistant_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"bytes" integer NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "console_assistant_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"model" text DEFAULT 'anthropic/claude-sonnet-4.5' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `DO $$ BEGIN
    ALTER TABLE "console_assistant_documents" ADD CONSTRAINT "console_assistant_documents_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_assistant_settings" ADD CONSTRAINT "console_assistant_settings_updated_by_console_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "baa307aabad680fe2ed4aadb") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_assistant_documents`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, documents: n });
}
