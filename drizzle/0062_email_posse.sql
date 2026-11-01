CREATE TABLE IF NOT EXISTS "console_mail_domain_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"domain" text NOT NULL,
	"token" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "console_mail_domain_claims" ADD CONSTRAINT "console_mail_domain_claims_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "console_mail_domain_claims" ADD CONSTRAINT "console_mail_domain_claims_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "console_mail_domain_claims_company_domain_unique" ON "console_mail_domain_claims" USING btree ("company_id","domain");
