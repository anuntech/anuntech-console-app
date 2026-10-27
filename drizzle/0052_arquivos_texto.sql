CREATE TABLE IF NOT EXISTS "console_file_texts" (
	"bookmark_id" text PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"status" text NOT NULL,
	"text" text,
	"reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese'::regconfig, lower(translate(coalesce("text", ''), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ', 'aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY')))) STORED,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "console_file_texts" ADD CONSTRAINT "console_file_texts_bookmark_id_console_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."console_bookmarks"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_file_text_search_idx" ON "console_file_texts" USING gin ("search");