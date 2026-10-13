ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "board" jsonb;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "preview" "bytea";
