CREATE TABLE IF NOT EXISTS "console_push_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"app_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_push_devices" ADD CONSTRAINT "console_push_devices_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_push_devices_token_unique" ON "console_push_devices" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_push_devices_user_idx" ON "console_push_devices" USING btree ("user_id");
