import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: lets task comments record an edit in production (drizzle/0034). Removed right after it runs. */
const STATEMENTS = [
  `ALTER TABLE "console_task_comments" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone`,
];

export async function GET(request: Request) {
  if (request.headers.get("x-once-token") !== "e1bdbf8130f870a3c7325e3d") return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from console_task_comments where edited_at is not null`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, edited: n });
}
