import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * One-shot runner for drizzle/0018_tasks.sql from inside the Vercel runtime,
 * where production DATABASE_URL exists. Idempotent; remove after use.
 */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_tasks" (
      "id" text PRIMARY KEY NOT NULL,
      "engagement_id" text NOT NULL,
      "company_id" text NOT NULL,
      "title" text NOT NULL,
      "description" text,
      "status" text DEFAULT 'todo' NOT NULL,
      "priority" text DEFAULT 'normal' NOT NULL,
      "assignee_id" text,
      "due_date" date,
      "position" integer DEFAULT 0 NOT NULL,
      "created_by" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  const constraints = [
    [
      "console_tasks_engagement_id_console_engagements_id_fk",
      sql`ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_tasks_company_id_console_companies_id_fk",
      sql`ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_tasks_assignee_id_console_user_id_fk",
      sql`ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_assignee_id_console_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_tasks_created_by_console_user_id_fk",
      sql`ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_created_by_console_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(
      sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`,
    );
    if (existing.rowCount) continue;
    await db.execute(statement);
    added.push(name);
  }
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "console_task_engagement_idx" ON "console_tasks" USING btree ("engagement_id")`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "console_task_board_idx" ON "console_tasks" USING btree ("engagement_id","status","position")`,
  );
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_tasks' ORDER BY ordinal_position`,
  );
  return Response.json({
    table: "console_tasks",
    columns: columns.rows.map((row) => row.column_name),
    constraintsAdded: added,
  });
}
