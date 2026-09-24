CREATE TABLE "console_contract_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"document_hash" text NOT NULL,
	"sent_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "kind" text DEFAULT 'contract' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "starts_at" date;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "ends_at" date;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "expiry_notice_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_contracts" ADD COLUMN "expired_notice_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "console_contract_versions" ADD CONSTRAINT "console_contract_versions_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_contract_versions" ADD CONSTRAINT "console_contract_versions_sent_by_console_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "console_contract_version_unique" ON "console_contract_versions" USING btree ("contract_id","version");--> statement-breakpoint
ALTER TABLE "console_contracts" ADD CONSTRAINT "console_contracts_parent_id_console_contracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action;