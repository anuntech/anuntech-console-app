CREATE TABLE "console_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"engagement_id" text NOT NULL,
	"company_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assignee_id" text,
	"due_date" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_assignee_id_console_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD CONSTRAINT "console_tasks_created_by_console_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_task_engagement_idx" ON "console_tasks" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "console_task_board_idx" ON "console_tasks" USING btree ("engagement_id","status","position");