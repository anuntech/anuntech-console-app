import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * One-shot runner for drizzle/0020_task_assignees.sql from inside the Vercel
 * runtime, where production DATABASE_URL exists. Idempotent; remove after use.
 */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_task_assignees" (
      "task_id" text NOT NULL,
      "user_id" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "console_task_assignees_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
    )`);
  const constraints = [
    [
      "console_task_assignees_task_id_console_tasks_id_fk",
      sql`ALTER TABLE "console_task_assignees" ADD CONSTRAINT "console_task_assignees_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_task_assignees_user_id_console_user_id_fk",
      sql`ALTER TABLE "console_task_assignees" ADD CONSTRAINT "console_task_assignees_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(statement);
    added.push(name);
  }
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "console_task_assignee_user_idx" ON "console_task_assignees" USING btree ("user_id")`,
  );
  const column = await db.execute(
    sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'console_tasks' AND column_name = 'assignee_id'`,
  );
  let migrated = 0;
  if (column.rowCount) {
    const copied = await db.execute(
      sql`INSERT INTO "console_task_assignees" ("task_id", "user_id") SELECT "id", "assignee_id" FROM "console_tasks" WHERE "assignee_id" IS NOT NULL ON CONFLICT DO NOTHING`,
    );
    migrated = copied.rowCount ?? 0;
    await db.execute(
      sql`ALTER TABLE "console_tasks" DROP CONSTRAINT IF EXISTS "console_tasks_assignee_id_console_user_id_fk"`,
    );
    await db.execute(sql`ALTER TABLE "console_tasks" DROP COLUMN "assignee_id"`);
  }
  const rows = await db.execute(sql`SELECT count(*)::int AS n FROM "console_task_assignees"`);
  return Response.json({
    constraintsAdded: added,
    assigneeColumnDropped: !!column.rowCount,
    migrated,
    assignees: rows.rows[0]?.n ?? null,
  });
}
