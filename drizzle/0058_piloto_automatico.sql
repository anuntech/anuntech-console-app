CREATE TABLE IF NOT EXISTS "console_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"company_id" text,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "console_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"company_id" text,
	"event_id" text,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft" text,
	"level" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"dismiss_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_events" ADD CONSTRAINT "console_events_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_decisions" ADD CONSTRAINT "console_decisions_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_decisions" ADD CONSTRAINT "console_decisions_event_id_console_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."console_events"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_decisions" ADD CONSTRAINT "console_decisions_decided_by_console_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."console_user"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_event_key_unique" ON "console_events" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_event_pending_idx" ON "console_events" USING btree ("processed_at","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_decision_unique" ON "console_decisions" USING btree ("kind","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_decision_status_idx" ON "console_decisions" USING btree ("status","created_at");