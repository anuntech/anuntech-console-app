ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "tag" text;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "tag_source" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_bookmark_tag_idx" ON "console_bookmarks" USING btree ("tag");