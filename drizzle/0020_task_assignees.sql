CREATE TABLE "console_task_assignees" (
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_task_assignees_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "console_tasks" DROP CONSTRAINT "console_tasks_assignee_id_console_user_id_fk";
--> statement-breakpoint
ALTER TABLE "console_task_assignees" ADD CONSTRAINT "console_task_assignees_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_task_assignees" ADD CONSTRAINT "console_task_assignees_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_task_assignee_user_idx" ON "console_task_assignees" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "console_task_assignees" ("task_id", "user_id") SELECT "id", "assignee_id" FROM "console_tasks" WHERE "assignee_id" IS NOT NULL ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "console_tasks" DROP COLUMN "assignee_id";