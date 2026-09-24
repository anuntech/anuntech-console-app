CREATE TABLE "console_bookmark_folder_shares" (
	"folder_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_bookmark_folder_shares_folder_id_user_id_pk" PRIMARY KEY("folder_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "console_bookmark_folders" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_bookmarks" DROP CONSTRAINT "console_bookmarks_company_id_console_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "console_bookmarks" DROP CONSTRAINT "console_bookmarks_engagement_id_console_engagements_id_fk";
--> statement-breakpoint
DROP INDEX "console_bookmark_company_idx";--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "console_bookmark_folder_shares" ADD CONSTRAINT "console_bookmark_folder_shares_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_bookmark_folder_shares" ADD CONSTRAINT "console_bookmark_folder_shares_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_bookmark_folders" ADD CONSTRAINT "console_bookmark_folders_owner_id_console_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_bookmark_share_user_idx" ON "console_bookmark_folder_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "console_bookmark_folder_owner_idx" ON "console_bookmark_folders" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "console_bookmarks" ADD CONSTRAINT "console_bookmarks_folder_id_console_bookmark_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."console_bookmark_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_bookmark_owner_idx" ON "console_bookmarks" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "console_bookmark_folder_idx" ON "console_bookmarks" USING btree ("folder_id");--> statement-breakpoint
ALTER TABLE "console_bookmarks" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "console_bookmarks" DROP COLUMN "engagement_id";