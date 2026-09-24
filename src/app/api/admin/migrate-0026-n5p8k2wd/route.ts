import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** One-shot runner for drizzle/0026_contract_signatures.sql; idempotent, remove after use. */
export async function GET() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_contract_signatures" (
      "id" text PRIMARY KEY NOT NULL,
      "contract_id" text NOT NULL,
      "party" text NOT NULL,
      "user_id" text NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "document_hash" text NOT NULL,
      "ip" text,
      "user_agent" text,
      "method" text DEFAULT 'otp_session' NOT NULL,
      "session_started_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "console_contract_templates" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "body" text NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);
  for (const column of [
    `"template_id" text`,
    `"engagement_id" text`,
    `"status" text DEFAULT 'draft' NOT NULL`,
    `"document_hash" text`,
    `"signed_at" timestamp with time zone`,
    `"signed_pdf" bytea`,
  ])
    await db.execute(sql.raw(`ALTER TABLE "console_contracts" ADD COLUMN IF NOT EXISTS ${column}`));
  const constraints = [
    [
      "console_contract_signatures_contract_id_console_contracts_id_fk",
      `ALTER TABLE "console_contract_signatures" ADD CONSTRAINT "console_contract_signatures_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_contract_signatures_user_id_console_user_id_fk",
      `ALTER TABLE "console_contract_signatures" ADD CONSTRAINT "console_contract_signatures_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_contracts_template_id_console_contract_templates_id_fk",
      `ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_template_id_console_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."console_contract_templates"("id") ON DELETE no action ON UPDATE no action`,
    ],
    [
      "console_contracts_engagement_id_console_engagements_id_fk",
      `ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action`,
    ],
  ] as const;
  const added: string[] = [];
  for (const [name, statement] of constraints) {
    const existing = await db.execute(sql`SELECT 1 FROM pg_constraint WHERE conname = ${name}`);
    if (existing.rowCount) continue;
    await db.execute(sql.raw(statement));
    added.push(name);
  }
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "console_contract_signature_contract_idx" ON "console_contract_signatures" USING btree ("contract_id")`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "console_contract_signature_party_unique" ON "console_contract_signatures" USING btree ("contract_id","party")`);
  // Contracts published under the old flow were waiting for nothing; keep them readable as sent.
  const migrated = await db.execute(
    sql`UPDATE "console_contracts" SET "status" = 'sent' WHERE "status" = 'draft' AND "published_at" IS NOT NULL AND "publication" IS NOT NULL`,
  );
  const columns = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'console_contracts' ORDER BY ordinal_position`,
  );
  return Response.json({
    constraintsAdded: added,
    publishedMarkedSent: migrated.rowCount ?? 0,
    contractColumns: columns.rows.map((r) => r.column_name),
  });
}
