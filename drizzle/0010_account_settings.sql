CREATE TABLE "console_account_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_account_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "console_staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "console_staff_members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "console_two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "console_two_factor_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "console_user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "console_user" ADD COLUMN "two_step_channel" text DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_account_emails" ADD CONSTRAINT "console_account_emails_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_staff_members" ADD CONSTRAINT "console_staff_members_created_by_console_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."console_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_staff_members" ADD CONSTRAINT "console_staff_members_updated_by_console_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."console_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "console_two_factor" ADD CONSTRAINT "console_two_factor_user_id_console_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO console_account_emails (id,user_id,email,verified_at,created_at)
SELECT gen_random_uuid()::text,id,lower(email),CASE WHEN email_verified THEN created_at ELSE NULL END,created_at
FROM console_user;
--> statement-breakpoint
CREATE FUNCTION console_reserve_account_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO console_account_emails (id,user_id,email,verified_at)
  VALUES (gen_random_uuid()::text,NEW.id,lower(NEW.email),CASE WHEN NEW.email_verified THEN now() ELSE NULL END)
  ON CONFLICT (email) DO UPDATE SET verified_at = CASE WHEN NEW.email_verified THEN COALESCE(console_account_emails.verified_at,now()) ELSE NULL END
  WHERE console_account_emails.user_id=NEW.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email already belongs to another account' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER console_user_email_registry AFTER INSERT OR UPDATE OF email,email_verified ON console_user
FOR EACH ROW EXECUTE FUNCTION console_reserve_account_email();
--> statement-breakpoint
CREATE FUNCTION console_protect_verified_contacts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.two_factor_enabled AND (
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.email_verified IS DISTINCT FROM OLD.email_verified OR
    NEW.phone_number IS DISTINCT FROM OLD.phone_number OR
    NEW.phone_number_verified IS DISTINCT FROM OLD.phone_number_verified
  ) THEN
    RAISE EXCEPTION 'Disable two-step verification before changing verified contacts' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER console_user_protected_contacts BEFORE UPDATE ON console_user
FOR EACH ROW EXECUTE FUNCTION console_protect_verified_contacts();
