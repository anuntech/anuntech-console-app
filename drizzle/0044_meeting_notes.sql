CREATE TABLE IF NOT EXISTS "console_app_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"app" text NOT NULL,
	"device" text,
	"challenge" text,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"token_hash" text,
	"connected_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_app_connections_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "console_app_connections_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN IF NOT EXISTS "meeting" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "console_app_connections" ADD CONSTRAINT "console_app_connections_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_app_connection_user_idx" ON "console_app_connections" USING btree ("user_id");
