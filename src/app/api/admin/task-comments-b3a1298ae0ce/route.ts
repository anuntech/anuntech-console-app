import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: creates the task comments table in production (drizzle/0032). Removed right after it runs. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "console_task_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)`,
  `DO $$ BEGIN
    ALTER TABLE "console_task_comments" ADD CONSTRAINT "console_task_comments_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "console_task_comments" ADD CONSTRAINT "console_task_comments_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "console_task_comment_task_idx" ON "console_task_comments" USING btree ("task_id","created_at")`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "b3a1298ae0ce366722f9f50e") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_task_comments`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, comments: n });
}
