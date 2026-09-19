CREATE TABLE "console_ticket_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"provider_status" text,
	"error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_ticket_notices" ADD CONSTRAINT "console_ticket_notices_event_id_console_audit_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."console_audit_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_ticket_notices" ADD CONSTRAINT "console_ticket_notices_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_ticket_notice_event_recipient_idx" ON "console_ticket_notices" USING btree ("event_id","channel","destination");--> statement-breakpoint
CREATE INDEX "console_ticket_notice_pending_idx" ON "console_ticket_notices" USING btree ("status","next_attempt_at");