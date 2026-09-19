CREATE TABLE "console_billing_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"payload" jsonb,
	"provider_id" text,
	"provider_status" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"engagement_id" text,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval" text NOT NULL,
	"anchor_day" integer NOT NULL,
	"anchor_month" integer NOT NULL,
	"next_due_date" date NOT NULL,
	"lead_days" integer DEFAULT 5 NOT NULL,
	"collection_days" integer DEFAULT 30 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"actor_id" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "public_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "boleto_pdf" text;--> statement-breakpoint
ALTER TABLE "console_billing_notices" ADD CONSTRAINT "console_billing_notices_invoice_id_console_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."console_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_billing_notices" ADD CONSTRAINT "console_billing_notices_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD CONSTRAINT "console_subscriptions_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD CONSTRAINT "console_subscriptions_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_subscriptions" ADD CONSTRAINT "console_subscriptions_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_billing_notice_event_idx" ON "console_billing_notices" USING btree ("invoice_id","channel","kind");--> statement-breakpoint
CREATE INDEX "console_billing_notice_pending_idx" ON "console_billing_notices" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "console_invoices" ADD CONSTRAINT "console_invoices_subscription_id_console_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."console_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_invoice_subscription_due_unique" ON "console_invoices" USING btree ("subscription_id","due_date");--> statement-breakpoint
ALTER TABLE "console_invoices" ADD CONSTRAINT "console_invoices_public_id_unique" UNIQUE("public_id");