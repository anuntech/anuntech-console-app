import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: creates the assistant history tables in production (drizzle/0031). Removed right after it runs. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "console_assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS "console_assistant_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"steps" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `DO $$ BEGIN
    ALTER TABLE "console_assistant_conversations" ADD CONSTRAINT "console_assistant_conversations_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_assistant_messages" ADD CONSTRAINT "console_assistant_messages_conversation_id_console_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."console_assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "console_assistant_conversation_user_idx" ON "console_assistant_conversations" USING btree ("user_id","updated_at")`,
  `CREATE INDEX IF NOT EXISTS "console_assistant_message_conversation_idx" ON "console_assistant_messages" USING btree ("conversation_id","created_at")`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "99cf837846b34b54aa107fac") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_assistant_conversations`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, conversations: n });
}
