CREATE INDEX IF NOT EXISTS "console_audit_company_created_idx" ON "console_audit_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_audit_created_idx" ON "console_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_contract_status_ends_idx" ON "console_contracts" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_invoice_status_due_idx" ON "console_invoices" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "console_ticket_status_updated_idx" ON "console_tickets" USING btree ("status","updated_at");