CREATE TABLE IF NOT EXISTS "console_mail_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"domain" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_mail_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "console_mail_domains" ADD CONSTRAINT "console_mail_domains_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "console_mail_domains" ADD CONSTRAINT "console_mail_domains_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_mail_domains_company_idx" ON "console_mail_domains" USING btree ("company_id");
