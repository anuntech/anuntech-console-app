import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: lets attachments belong to a task comment in production (drizzle/0033). Removed right after it runs. */
const STATEMENTS = [
  `ALTER TABLE "console_attachments" ADD COLUMN IF NOT EXISTS "comment_id" text`,
  `DO $$ BEGIN
    ALTER TABLE "console_attachments" ADD CONSTRAINT "console_attachments_comment_id_console_task_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."console_task_comments"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "console_attachment_comment_idx" ON "console_attachments" USING btree ("comment_id")`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "537c45a1ba9d9feef8da6f68") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_attachments where comment_id is not null`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, commentFiles: n });
}
