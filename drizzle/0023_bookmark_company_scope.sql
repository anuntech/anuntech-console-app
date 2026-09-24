ALTER TABLE "console_bookmark_folders" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "console_bookmark_folders" ADD COLUMN "visibility" text DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "console_bookmark_folders" ADD CONSTRAINT "console_bookmark_folders_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_bookmark_folder_company_idx" ON "console_bookmark_folders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "console_bookmark_company_idx" ON "console_bookmarks" USING btree ("company_id");