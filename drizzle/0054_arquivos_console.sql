ALTER TABLE "console_bookmark_folders" ADD COLUMN IF NOT EXISTS "origin" text;--> statement-breakpoint
ALTER TABLE "console_bookmark_folders" ADD COLUMN IF NOT EXISTS "area" text;--> statement-breakpoint
ALTER TABLE "console_bookmark_folders" ADD COLUMN IF NOT EXISTS "engagement_id" text;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "origin" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_bookmark_folders" ADD CONSTRAINT "console_bookmark_folders_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_bookmark_folder_origin_idx" ON "console_bookmark_folders" USING btree ("company_id","origin") WHERE "console_bookmark_folders"."origin" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_bookmark_folder_engagement_idx" ON "console_bookmark_folders" USING btree ("engagement_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_bookmark_origin_idx" ON "console_bookmarks" USING btree ("origin") WHERE "console_bookmarks"."origin" is not null;