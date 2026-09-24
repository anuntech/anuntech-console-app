ALTER TABLE "console_invoices" ADD COLUMN "discount_cents" integer;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "fine_bps" integer;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "interest_monthly_bps" integer;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD COLUMN "discount_cents" integer;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD COLUMN "fine_bps" integer;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD COLUMN "interest_monthly_bps" integer;