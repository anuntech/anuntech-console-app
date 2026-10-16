CREATE TABLE IF NOT EXISTS "console_assistant_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"tool" text NOT NULL,
	"args" jsonb NOT NULL,
	"args_hash" text NOT NULL,
	"title" text NOT NULL,
	"details" jsonb NOT NULL,
	"nonce_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tainted" boolean DEFAULT false NOT NULL,
	"path" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_assistant_proposals" ADD CONSTRAINT "console_assistant_proposals_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_assistant_proposals" ADD CONSTRAINT "console_assistant_proposals_conversation_id_console_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."console_assistant_conversations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_assistant_proposal_user_idx" ON "console_assistant_proposals" USING btree ("user_id","created_at");
