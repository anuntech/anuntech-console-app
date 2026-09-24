CREATE TABLE "console_assistant_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"bytes" integer NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_assistant_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"model" text DEFAULT 'anthropic/claude-sonnet-4.5' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_assistant_documents" ADD CONSTRAINT "console_assistant_documents_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_assistant_settings" ADD CONSTRAINT "console_assistant_settings_updated_by_console_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;