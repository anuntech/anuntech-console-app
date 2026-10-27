CREATE TABLE IF NOT EXISTS "console_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"company_id" text,
	"folder_id" text,
	"bookmark_id" text,
	"title" text NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"max_downloads" integer,
	"downloads" integer DEFAULT 0 NOT NULL,
	"uploads" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "console_share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "console_file_uploads" ADD COLUMN IF NOT EXISTS "share_link_id" text;--> statement-breakpoint
ALTER TABLE "console_file_uploads" ADD COLUMN IF NOT EXISTS "visitor_secret_hash" text;--> statement-breakpoint
ALTER TABLE "console_file_uploads" ADD COLUMN IF NOT EXISTS "sender_name" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_share_links" ADD CONSTRAINT "console_share_links_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_share_links" ADD CONSTRAINT "console_share_links_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_share_links" ADD CONSTRAINT "console_share_links_bookmark_id_console_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."console_bookmarks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_share_links" ADD CONSTRAINT "console_share_links_created_by_console_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_share_link_folder_idx" ON "console_share_links" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_share_link_bookmark_idx" ON "console_share_links" USING btree ("bookmark_id");--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_uploads" ADD CONSTRAINT "console_file_uploads_share_link_id_console_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."console_share_links"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;