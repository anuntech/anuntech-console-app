CREATE TABLE IF NOT EXISTS "console_membership_engagements" (
	"membership_id" text NOT NULL,
	"engagement_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_membership_engagements_membership_id_engagement_id_pk" PRIMARY KEY("membership_id","engagement_id")
);
--> statement-breakpoint
ALTER TABLE "console_catalog_items" ADD COLUMN IF NOT EXISTS "icon" text;--> statement-breakpoint
ALTER TABLE "console_memberships" ADD COLUMN IF NOT EXISTS "engagement_access" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_membership_engagements" ADD CONSTRAINT "console_membership_engagements_membership_id_console_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."console_memberships"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_membership_engagements" ADD CONSTRAINT "console_membership_engagements_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_membership_engagements_engagement_idx" ON "console_membership_engagements" USING btree ("engagement_id");
