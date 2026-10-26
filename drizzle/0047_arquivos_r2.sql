CREATE TABLE IF NOT EXISTS "console_file_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"company_id" text,
	"folder_id" text,
	"file_name" text NOT NULL,
	"mime" text,
	"size" bigint NOT NULL,
	"part_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"multipart_id" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "storage_key" text;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "file_size" bigint;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "mime" text;--> statement-breakpoint
ALTER TABLE "console_companies" ADD COLUMN IF NOT EXISTS "storage_quota_bytes" bigint;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_uploads" ADD CONSTRAINT "console_file_uploads_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_uploads" ADD CONSTRAINT "console_file_uploads_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_uploads" ADD CONSTRAINT "console_file_uploads_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_file_upload_company_idx" ON "console_file_uploads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_file_upload_actor_idx" ON "console_file_uploads" USING btree ("actor_id");