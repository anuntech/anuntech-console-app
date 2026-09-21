CREATE TABLE "console_environment_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"document" text NOT NULL,
	"billing_email" text NOT NULL,
	"phone" text,
	"billing_address" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "console_billing_notice_event_idx";--> statement-breakpoint
ALTER TABLE "console_billing_notices" ADD COLUMN "recipient" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "console_notification_preferences" ADD COLUMN "emails" jsonb;--> statement-breakpoint
ALTER TABLE "console_notification_preferences" ADD COLUMN "phones" jsonb;--> statement-breakpoint
-- Freeze the original destination for existing deliveries and pending notices.
UPDATE console_billing_notices b SET recipient = CASE WHEN b.channel = 'email' THEN
  coalesce(nullif(CASE WHEN jsonb_typeof(b.payload->'to') = 'array' THEN b.payload->'to'->>0 ELSE b.payload->>'to' END,''),p.email,c.billing_email,'')
  ELSE CASE WHEN length(regexp_replace(coalesce(b.payload->>'to',p.phone,c.phone,''),'[^0-9]','','g')) BETWEEN 10 AND 11 THEN '55' ELSE '' END || regexp_replace(coalesce(b.payload->>'to',p.phone,c.phone,''),'[^0-9]','','g') END
FROM console_invoices i JOIN console_companies c ON c.id=i.company_id LEFT JOIN console_notification_preferences p ON p.company_id=c.id AND p.topic='billing'
WHERE i.id=b.invoice_id;
--> statement-breakpoint
CREATE UNIQUE INDEX "console_billing_notice_event_idx" ON "console_billing_notices" USING btree ("invoice_id","channel","kind","recipient");--> statement-breakpoint
-- Older application instances still omit recipient while a deployment rolls out.
-- Resolve it before uniqueness checks, so they cannot create a duplicate seed.
CREATE FUNCTION console_billing_notice_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE configured text;
BEGIN
  IF NEW.recipient = '' THEN
    SELECT CASE WHEN NEW.channel='email' THEN coalesce(p.email,c.billing_email,'') ELSE coalesce(p.phone,c.phone,'') END INTO configured
      FROM console_invoices i JOIN console_companies c ON c.id=i.company_id
      LEFT JOIN console_notification_preferences p ON p.company_id=c.id AND p.topic='billing' WHERE i.id=NEW.invoice_id;
    NEW.recipient := coalesce(nullif(CASE WHEN jsonb_typeof(NEW.payload->'to')='array' THEN NEW.payload->'to'->>0 ELSE NEW.payload->>'to' END,''), configured, '');
    IF NEW.channel='whatsapp' THEN
      NEW.recipient := regexp_replace(NEW.recipient,'[^0-9]','','g');
      IF length(NEW.recipient) BETWEEN 10 AND 11 THEN NEW.recipient := '55'||NEW.recipient; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER console_billing_notice_recipient_before_insert BEFORE INSERT ON console_billing_notices FOR EACH ROW EXECUTE FUNCTION console_billing_notice_recipient();
