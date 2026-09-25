CREATE TABLE "console_assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_assistant_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"steps" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_assistant_conversations" ADD CONSTRAINT "console_assistant_conversations_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_assistant_messages" ADD CONSTRAINT "console_assistant_messages_conversation_id_console_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."console_assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_assistant_conversation_user_idx" ON "console_assistant_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "console_assistant_message_conversation_idx" ON "console_assistant_messages" USING btree ("conversation_id","created_at");