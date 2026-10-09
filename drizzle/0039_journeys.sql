CREATE TABLE "console_journey_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"journey_id" text NOT NULL,
	"key" text NOT NULL,
	"title" text,
	"stage" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"note" text,
	"url" text,
	"value" text,
	"scheduled_at" timestamp with time zone,
	"assignee_id" text,
	"done_by" text,
	"done_at" timestamp with time zone,
	"ai_draft" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"company_id" text,
	"lead" jsonb,
	"ticket_id" text,
	"quote_id" text,
	"engagement_id" text,
	"hosting_engagement_id" text,
	"owner_id" text,
	"template" text DEFAULT 'projeto-v1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"briefing" jsonb,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_journey_steps" ADD CONSTRAINT "console_journey_steps_journey_id_console_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."console_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journey_steps" ADD CONSTRAINT "console_journey_steps_assignee_id_console_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journey_steps" ADD CONSTRAINT "console_journey_steps_done_by_console_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_quote_id_console_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."console_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_hosting_engagement_id_console_engagements_id_fk" FOREIGN KEY ("hosting_engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_journeys" ADD CONSTRAINT "console_journeys_owner_id_console_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_journey_steps_unique" ON "console_journey_steps" USING btree ("journey_id","key");--> statement-breakpoint
CREATE INDEX "console_journeys_company_idx" ON "console_journeys" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "console_journeys_quote_unique" ON "console_journeys" USING btree ("quote_id");