import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { suggestGalleryIcon } from "@/lib/catalog/catalog-icons";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: what each Membro sees and the catalog icons in production
 * (drizzle/0041), plus a gallery icon for each catalog item that has none, picked
 * by name. Removed right after it runs.
 */
const TOKEN_SHA256 = "666273e43c19731c0cd901acea4d977353a385fa05ce9014a8e0f6717da5742c";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_membership_engagements\" ( \"membership_id\" text NOT NULL, \"engagement_id\" text NOT NULL, \"created_at\" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT \"console_membership_engagements_membership_id_engagement_id_pk\" PRIMARY KEY(\"membership_id\",\"engagement_id\") )",
  "ALTER TABLE \"console_catalog_items\" ADD COLUMN IF NOT EXISTS \"icon\" text",
  "ALTER TABLE \"console_memberships\" ADD COLUMN IF NOT EXISTS \"engagement_access\" text DEFAULT 'all' NOT NULL",
  "DO $$ BEGIN ALTER TABLE \"console_membership_engagements\" ADD CONSTRAINT \"console_membership_engagements_membership_id_console_memberships_id_fk\" FOREIGN KEY (\"membership_id\") REFERENCES \"public\".\"console_memberships\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "DO $$ BEGIN ALTER TABLE \"console_membership_engagements\" ADD CONSTRAINT \"console_membership_engagements_engagement_id_console_engagements_id_fk\" FOREIGN KEY (\"engagement_id\") REFERENCES \"public\".\"console_engagements\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$",
  "CREATE INDEX IF NOT EXISTS \"console_membership_engagements_engagement_idx\" ON \"console_membership_engagements\" USING btree (\"engagement_id\")",
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const items = (await db.execute(sql`select id, name, icon from console_catalog_items order by name`)).rows as { id: string; name: string; icon: string | null }[];
  const icons = [];
  for (const item of items) {
    const suggested = item.icon ? null : suggestGalleryIcon(item.name);
    if (suggested) await db.execute(sql`update console_catalog_items set icon = ${suggested.path}, updated_at = now() where id = ${item.id} and icon is null`);
    icons.push({ name: item.name, icon: item.icon ?? suggested?.path ?? null });
  }
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from information_schema.columns where table_name = 'console_memberships' and column_name = 'engagement_access'`)).rows as { n: number }[];
  return Response.json({ ok: true, statements: STATEMENTS.length, engagementAccess: n === 1, icons });
}
