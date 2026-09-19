ALTER TABLE "console_invoices" ADD COLUMN "bank_request" jsonb;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "bank_base" text;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "bank_status" text;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "bank_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "boleto_line" text;