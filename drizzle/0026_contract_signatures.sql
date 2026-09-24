CREATE TABLE "console_contract_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"party" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"document_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"method" text DEFAULT 'otp_session' NOT NULL,
	"session_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_contract_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "engagement_id" text;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "document_hash" text;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "signed_pdf" "bytea";--> statement-breakpoint
ALTER TABLE "console_contract_signatures" ADD CONSTRAINT "console_contract_signatures_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_contract_signatures" ADD CONSTRAINT "console_contract_signatures_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_contract_signature_contract_idx" ON "console_contract_signatures" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "console_contract_signature_party_unique" ON "console_contract_signatures" USING btree ("contract_id","party");--> statement-breakpoint
ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_template_id_console_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."console_contract_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;