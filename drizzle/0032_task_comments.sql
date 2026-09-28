CREATE TABLE "console_task_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_task_comments" ADD CONSTRAINT "console_task_comments_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_task_comments" ADD CONSTRAINT "console_task_comments_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_task_comment_task_idx" ON "console_task_comments" USING btree ("task_id","created_at");