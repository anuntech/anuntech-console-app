CREATE TABLE "console_ticket_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"name" text NOT NULL,
	"expected_size" integer NOT NULL,
	"received_size" integer DEFAULT 0 NOT NULL,
	"content" "bytea" NOT NULL,
	"mime" text,
	"ready" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_ticket_uploads" ADD CONSTRAINT "console_ticket_uploads_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_ticket_upload_author_idx" ON "console_ticket_uploads" USING btree ("author_id");