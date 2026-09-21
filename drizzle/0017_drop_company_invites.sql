-- The public company self-registration flow was removed. Any invite still in
-- "open"/"submitted" was never promoted into console_companies, so this drops
-- that pending data along with the table.
ALTER TABLE "console_company_invites" DROP CONSTRAINT IF EXISTS "console_company_invites_company_id_console_companies_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "console_company_invites";
