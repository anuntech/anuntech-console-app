CREATE TABLE "console_automation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"company_id" text,
	"actor_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_cron_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "console_environment_profile" ADD COLUMN "automations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "console_quotes" ADD COLUMN "ticket_id" text;--> statement-breakpoint
ALTER TABLE "console_automation_events" ADD CONSTRAINT "console_automation_events_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_automation_events" ADD CONSTRAINT "console_automation_events_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_automation_event_unique" ON "console_automation_events" USING btree ("kind","entity_id");--> statement-breakpoint
CREATE INDEX "console_automation_event_company_idx" ON "console_automation_events" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_quote_id_console_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."console_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_quote_id_console_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."console_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD CONSTRAINT "console_invoices_quote_id_console_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."console_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_quotes" ADD CONSTRAINT "console_quotes_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE no action ON UPDATE no action;