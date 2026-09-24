CREATE TABLE "console_catalog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text,
	"default_amount_cents" integer,
	"interval" text,
	"what_we_do" text,
	"what_we_need" text,
	"expected_results" text,
	"deadlines" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_engagements" ADD COLUMN "catalog_item_id" text;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD COLUMN "amount_cents" integer;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_catalog_item_id_console_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."console_catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_engagements" ADD CONSTRAINT "console_engagements_subscription_id_console_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."console_subscriptions"("id") ON DELETE no action ON UPDATE no action;