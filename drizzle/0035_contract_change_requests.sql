CREATE TABLE "console_contract_change_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"version" integer NOT NULL,
	"block_index" integer NOT NULL,
	"label" text NOT NULL,
	"excerpt" text NOT NULL,
	"comment" text NOT NULL,
	"proposed_text" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"response" text,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_contract_id_console_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."console_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_contract_change_requests" ADD CONSTRAINT "console_contract_change_requests_decided_by_console_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_contract_change_contract_idx" ON "console_contract_change_requests" USING btree ("contract_id","version");