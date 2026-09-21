CREATE TABLE "console_notification_preferences" (
	"key" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"topic" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"email_enabled" boolean NOT NULL,
	"whatsapp_enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_ticket_notices" ADD COLUMN "preference_key" text;--> statement-breakpoint
ALTER TABLE "console_notification_preferences" ADD CONSTRAINT "console_notification_preferences_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action;