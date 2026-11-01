import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
export const runtime = "nodejs";

/** One-shot, idempotent: 0062_email_posse.sql in production before the code that reads it ships. Removed in the next deploy. */
const TOKEN_SHA256 = "fc6a96d4acebe36be3aa4945f6baf8071bf15d03be05e1435fb3917037d6ca57";
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS \"console_mail_domain_claims\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"company_id\" text NOT NULL,\n\t\"domain\" text NOT NULL,\n\t\"token\" text NOT NULL,\n\t\"actor_id\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"checked_at\" timestamp with time zone\n);",
  "DO $$ BEGIN ALTER TABLE \"console_mail_domain_claims\" ADD CONSTRAINT \"console_mail_domain_claims_company_id_console_companies_id_fk\" FOREIGN KEY (\"company_id\") REFERENCES \"public\".\"console_companies\"(\"id\") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "DO $$ BEGIN ALTER TABLE \"console_mail_domain_claims\" ADD CONSTRAINT \"console_mail_domain_claims_actor_id_console_user_id_fk\" FOREIGN KEY (\"actor_id\") REFERENCES \"public\".\"console_user\"(\"id\") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"console_mail_domain_claims_company_domain_unique\" ON \"console_mail_domain_claims\" USING btree (\"company_id\",\"domain\");",
];

export async function GET(request: Request) {
  const token = request.headers.get("x-once-token") ?? "";
  if (createHash("sha256").update(token).digest("hex") !== TOKEN_SHA256) return new Response(null, { status: 404 });
  for (const statement of STATEMENTS) await db.execute(sql.raw(statement));
  return Response.json({ ok: true, statements: STATEMENTS.length });
}
