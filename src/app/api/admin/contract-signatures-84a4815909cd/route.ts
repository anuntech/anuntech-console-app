import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/**
 * One-shot, idempotent: one signature per party and version in production
 * (drizzle/0042). The new unique index goes in before the old one goes out, so
 * the table is never without one. Also lists the contracts the old index was
 * holding back: a party signed an earlier version and not the current one.
 * Removed right after it runs.
 */
const TOKEN_SHA256 = "5575ff6d124a7ca536988be9c574a8262178bde459870336edcd279bb7580e98";
const STATEMENTS = [
  'CREATE UNIQUE INDEX IF NOT EXISTS "console_contract_signature_version_party_unique" ON "console_contract_signatures" USING btree ("contract_id","document_hash","party")',
  'DROP INDEX IF EXISTS "console_contract_signature_party_unique"',
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  const indexes = (
    await db.execute(
      sql`select indexname from pg_indexes where tablename = 'console_contract_signatures' order by indexname`,
    )
  ).rows.map((row) => (row as { indexname: string }).indexname);
  const waiting = (
    await db.execute(sql`
      select c.id, c.status, s.party
      from console_contracts c
      join console_contract_signatures s on s.contract_id = c.id and s.document_hash is distinct from c.document_hash
      where c.status = 'sent'
        and not exists (
          select 1 from console_contract_signatures n
          where n.contract_id = c.id and n.party = s.party and n.document_hash = c.document_hash
        )
      group by c.id, c.status, s.party
      order by c.id, s.party`)
  ).rows;
  return Response.json({ ok: true, statements: STATEMENTS.length, indexes, waiting });
}
