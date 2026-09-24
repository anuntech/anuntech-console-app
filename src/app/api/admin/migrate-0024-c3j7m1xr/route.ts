import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0024_catalog.sql; idempotent, remove after use. */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_catalog_items" (
      "id" text PRIMARY KEY NOT NULL,
      "kind" text NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "url" text,
      "default_amount_cents" integer,
      "interval" text,
      "what_we_do" text,
      "what_we_need" text,
      "expected_results" text,
      "deadlines" text,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  await db.execute(sql`ALTER TABLE "console_engagements" ADD COLUMN IF NOT EXISTS "catalog_item_id" text`);
  await db.execute(sql`ALTER TABLE "console_engagements" ADD COLUMN IF NOT EXISTS "amount_cents" integer`);
  await db.execute(sql`ALTER TABLE "console_engagements" ADD COLUMN IF NOT EXISTS "subscription_id" text`);
  const constraints = [
    [
      "console_engagements_catalog_item_id_console_catalog_items_id_fk",
      sql`ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_catalog_item_id_console_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."console_catalog_items"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_engagements_subscription_id_console_subscriptions_id_fk",
      sql`ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_subscription_id_console_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."console_subscriptions"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(statement);
    added.push(name);
  }
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_engagements' ORDER BY ordinal_position`,
  );
  return Response.json({ constraintsAdded: added, engagementColumns: columns.rows.map((r) => r.column_name) });
}
