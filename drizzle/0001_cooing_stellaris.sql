CREATE TABLE "console_email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"membership_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_email_deliveries" ADD CONSTRAINT "console_email_deliveries_membership_id_console_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."console_memberships"("id") ON DELETE no action ON UPDATE no action;