CREATE TABLE "console_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"company_id" text,
	"action" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text NOT NULL,
	"billing_email" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_companies_document_unique" UNIQUE("document")
);
--> statement-breakpoint
CREATE TABLE "console_engagements" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"engagement_id" text,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider_id" text,
	"pix_copy_paste" text,
	"boleto_url" text,
	"fiscal_status" text DEFAULT 'not_requested' NOT NULL,
	"fiscal_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_invoices_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "console_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "console_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "console_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "console_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "console_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"engagement_id" text,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"author_id" text NOT NULL,
	"assigned_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "console_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "console_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_account" ADD CONSTRAINT "console_account_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_attachments" ADD CONSTRAINT "console_attachments_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_attachments" ADD CONSTRAINT "console_attachments_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_audit_events" ADD CONSTRAINT "console_audit_events_actor_id_console_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_audit_events" ADD CONSTRAINT "console_audit_events_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD CONSTRAINT "console_invoices_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_invoices" ADD CONSTRAINT "console_invoices_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_memberships" ADD CONSTRAINT "console_memberships_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_messages" ADD CONSTRAINT "console_messages_ticket_id_console_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."console_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_messages" ADD CONSTRAINT "console_messages_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_session" ADD CONSTRAINT "console_session_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD CONSTRAINT "console_tickets_company_id_console_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."console_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD CONSTRAINT "console_tickets_engagement_id_console_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."console_engagements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_tickets" ADD CONSTRAINT "console_tickets_author_id_console_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."console_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "console_account_user_idx" ON "console_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "console_account_provider_idx" ON "console_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "console_attachment_ticket_idx" ON "console_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "console_audit_company_idx" ON "console_audit_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "console_engagement_company_idx" ON "console_engagements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "console_invoice_company_idx" ON "console_invoices" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "console_membership_unique" ON "console_memberships" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "console_membership_email_idx" ON "console_memberships" USING btree ("email");--> statement-breakpoint
CREATE INDEX "console_message_ticket_idx" ON "console_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "console_session_user_idx" ON "console_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "console_ticket_company_idx" ON "console_tickets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "console_verification_identifier_idx" ON "console_verification" USING btree ("identifier");