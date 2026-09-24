import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0027_contract_versions_validity.sql; idempotent, remove after use. */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_contract_versions" (
      "id" text PRIMARY KEY NOT NULL,
      "contract_id" text NOT NULL,
      "version" integer NOT NULL,
      "title" text NOT NULL,
      "body" text NOT NULL,
      "document_hash" text NOT NULL,
      "sent_by" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  for (const column of [
    `"kind" text DEFAULT 'contract' NOT NULL`,
    `"parent_id" text`,
    `"starts_at" date`,
    `"ends_at" date`,
    `"expiry_notice_sent_at" timestamp with time zone`,
    `"expired_notice_sent_at" timestamp with time zone`,
  ])
    await db.execute(sql.raw(`ALTER TABLE "console_contracts" ADD COLUMN IF NOT EXISTS ${column}`));
  const constraints = [
    [
      "console_contract_versions_contract_id_console_contracts_id_fk",
      `ALTER TABLE "console_contract_versions" ADD CONSTRAINT "console_contract_versions_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_contract_versions_sent_by_console_user_id_fk",
      `ALTER TABLE "console_contract_versions" ADD CONSTRAINT "console_contract_versions_sent_by_console_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_contracts_parent_id_console_contracts_id_fk",
      `ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_parent_id_console_contracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(sql.raw(statement));
    added.push(name);
  }
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS "console_contract_version_unique" ON "console_contract_versions" USING btree ("contract_id","version")`,
  );
  // Contracts sent before versions existed get their current text as version 1.
  const backfilled = await db.execute(sql`
    INSERT INTO "console_contract_versions" ("id", "contract_id", "version", "title", "body", "document_hash", "sent_by", "created_at")
    SELECT gen_random_uuid()::text, c."id", c."published_version", c."publication"->>'title', c."publication"->>'body', c."document_hash", c."author_id", COALESCE(c."published_at", c."updated_at")
    FROM "console_contracts" c
    WHERE c."status" IN ('sent', 'signed') AND c."document_hash" IS NOT NULL AND c."publication" IS NOT NULL AND c."published_version" > 0
      AND NOT EXISTS (SELECT 1 FROM "console_contract_versions" v WHERE v."contract_id" = c."id")`);
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_contracts' ORDER BY ordinal_position`,
  );
  return Response.json({
    constraintsAdded: added,
    versionsBackfilled: backfilled.rowCount ?? 0,
    contractColumns: columns.rows.map((r) => r.column_name),
  });
}
