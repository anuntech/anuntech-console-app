CREATE TABLE "console_bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"engagement_id" text,
	"title" text NOT NULL,
	"url" text,
	"file_name" text,
	"content" "bytea",
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_bookmark_company_idx" ON "console_bookmarks" USING btree ("company_id");