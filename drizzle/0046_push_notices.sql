CREATE TABLE IF NOT EXISTS "console_push_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"topic" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"audience" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"provider_id" text,
	"provider_status" text,
	"error" text,
	"receipt_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_push_notices" ADD CONSTRAINT "console_push_notices_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_push_notices" ADD CONSTRAINT "console_push_notices_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_push_notices" ADD CONSTRAINT "console_push_notices_device_id_console_push_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."console_push_devices"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_push_notices_event_device_unique" ON "console_push_notices" USING btree ("event_key","device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_push_notices_pending_idx" ON "console_push_notices" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_push_notices_company_idx" ON "console_push_notices" USING btree ("company_id");