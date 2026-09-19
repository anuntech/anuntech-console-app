ALTER TABLE "console_companies" ADD COLUMN "billing_address" jsonb;--> statement-breakpoint
ALTER TABLE "console_companies" ADD COLUMN "auto_issue_nfse" boolean DEFAULT false NOT NULL;