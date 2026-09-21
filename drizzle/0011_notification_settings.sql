CREATE TABLE "console_notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_notification_settings" ADD CONSTRAINT "console_notification_settings_updated_by_console_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."console_user"("id") ON DELETE set null ON UPDATE no action;