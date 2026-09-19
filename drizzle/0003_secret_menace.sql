CREATE TABLE "console_otp_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "console_user" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "console_user" ADD COLUMN "phone_number_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "console_user" ADD CONSTRAINT "console_user_phone_number_unique" UNIQUE("phone_number");