import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0061_email_dominios.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "ad7df7606e53bbc4440dcea9926de46824067364de4bc0bd829e8d5441a5bb28";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_mail_domains\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"domain\" text NOT NULL,\n\t\"actor_id\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"console_mail_domains_domain_unique\" UNIQUE(\"domain\")\n);",
  "DO $$ BEGIN ALTER TABLE \"console_mail_domains\" ADD CONSTRAINT \"console_mail_domains_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_mail_domains\" ADD CONSTRAINT \"console_mail_domains_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE INDEX IF NOT EXISTS \"console_mail_domains_company_idx\" ON \"console_mail_domains\" USING btree (\"company_id\");",
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
