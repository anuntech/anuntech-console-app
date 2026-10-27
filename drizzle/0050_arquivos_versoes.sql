CREATE TABLE IF NOT EXISTS "console_file_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"bookmark_id" text NOT NULL,
	"company_id" text,
	"version" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"mime" text,
	"storage_key" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_versions" ADD CONSTRAINT "console_file_versions_bookmark_id_console_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."console_bookmarks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_versions" ADD CONSTRAINT "console_file_versions_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_versions" ADD CONSTRAINT "console_file_versions_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_file_version_unique" ON "console_file_versions" USING btree ("bookmark_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_file_version_company_idx" ON "console_file_versions" USING btree ("company_id");