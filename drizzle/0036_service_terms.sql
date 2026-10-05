CREATE TABLE "console_hours_months" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"month" text NOT NULL,
	"overage_approved_minutes" integer DEFAULT 0 NOT NULL,
	"overage_approved_by" text,
	"overage_approved_at" timestamp with time zone,
	"report_sent_at" timestamp with time zone,
	"report_sent_by" text,
	"contested_at" timestamp with time zone,
	"contested_by" text,
	"contest_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_service_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"engagement_id" text,
	"basis" text NOT NULL,
	"preset" text NOT NULL,
	"label" text NOT NULL,
	"contract_id" text,
	"policy" jsonb NOT NULL,
	"person_client" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp with time zone,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"ticket_id" text,
	"engagement_id" text,
	"author_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"note" text NOT NULL,
	"worked_on" date NOT NULL,
	"kind" text DEFAULT 'bank' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_user_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_environment_profile" ADD COLUMN "holidays" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "review_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "impact" text;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "channel" text DEFAULT 'console' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "waiting_for" text;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "waiting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "paused_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "response_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "resolution_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "terms" jsonb;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "estimate_status" text;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "estimate_decided_by" text;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD COLUMN "estimate_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_hours_months" ADD CONSTRAINT "console_hours_months_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_hours_months" ADD CONSTRAINT "console_hours_months_overage_approved_by_console_user_id_fk" FOREIGN KEY ("overage_approved_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_hours_months" ADD CONSTRAINT "console_hours_months_report_sent_by_console_user_id_fk" FOREIGN KEY ("report_sent_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_hours_months" ADD CONSTRAINT "console_hours_months_contested_by_console_user_id_fk" FOREIGN KEY ("contested_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_service_terms" ADD CONSTRAINT "console_service_terms_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_service_terms" ADD CONSTRAINT "console_service_terms_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_service_terms" ADD CONSTRAINT "console_service_terms_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_service_terms" ADD CONSTRAINT "console_service_terms_verified_by_console_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_time_entries" ADD CONSTRAINT "console_time_entries_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_time_entries" ADD CONSTRAINT "console_time_entries_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_time_entries" ADD CONSTRAINT "console_time_entries_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_time_entries" ADD CONSTRAINT "console_time_entries_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_user_milestones" ADD CONSTRAINT "console_user_milestones_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_hours_month_unique" ON "console_hours_months" USING btree ("company_id","month");--> statement-breakpoint
CREATE INDEX "console_service_terms_company_idx" ON "console_service_terms" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "console_time_entry_company_idx" ON "console_time_entries" USING btree ("company_id","worked_on");--> statement-breakpoint
CREATE UNIQUE INDEX "console_user_milestone_unique" ON "console_user_milestones" USING btree ("user_id","company_id","key");--> statement-breakpoint
ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_approved_by_console_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD CONSTRAINT "console_tickets_estimate_decided_by_console_user_id_fk" FOREIGN KEY ("estimate_decided_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;