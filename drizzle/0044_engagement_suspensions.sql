CREATE TABLE IF NOT EXISTS "console_engagement_suspensions" (
	"id" text PRIMARY KEY NOT NULL,
	"engagement_id" text NOT NULL,
	"company_id" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"scheduled_for" date,
	"notice_sent_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"lift_reason" text,
	"lift_note" text,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_catalog_items" ADD COLUMN IF NOT EXISTS "suspension_kind" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_engagement_suspensions" ADD CONSTRAINT "console_engagement_suspensions_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_engagement_suspensions" ADD CONSTRAINT "console_engagement_suspensions_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_engagement_suspensions" ADD CONSTRAINT "console_engagement_suspensions_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_engagement_suspension_open_unique" ON "console_engagement_suspensions" USING btree ("engagement_id") WHERE "console_engagement_suspensions"."lifted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_engagement_suspension_company_idx" ON "console_engagement_suspensions" USING btree ("company_id");
