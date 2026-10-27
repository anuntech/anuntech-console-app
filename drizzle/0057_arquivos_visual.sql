CREATE TABLE IF NOT EXISTS "console_bookmark_stars" (
	"user_id" text NOT NULL,
	"bookmark_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_bookmark_stars_user_id_bookmark_id_pk" PRIMARY KEY("user_id","bookmark_id")
);
--> statement-breakpoint
ALTER TABLE "console_file_texts" ADD COLUMN IF NOT EXISTS "thumb_status" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_bookmark_stars" ADD CONSTRAINT "console_bookmark_stars_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_bookmark_stars" ADD CONSTRAINT "console_bookmark_stars_bookmark_id_console_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."console_bookmarks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_bookmark_star_item_idx" ON "console_bookmark_stars" USING btree ("bookmark_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_audit_actor_idx" ON "console_audit_events" USING btree ("actor_id","created_at");