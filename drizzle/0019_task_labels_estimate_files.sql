ALTER TABLE "console_attachments" ALTER COLUMN "ticket_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "console_attachments" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "labels" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_tasks" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "console_attachments" ADD CONSTRAINT "console_attachments_task_id_console_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."console_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_attachment_task_idx" ON "console_attachments" USING btree ("task_id");