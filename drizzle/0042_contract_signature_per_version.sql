CREATE UNIQUE INDEX IF NOT EXISTS "console_contract_signature_version_party_unique" ON "console_contract_signatures" USING btree ("contract_id","document_hash","party");--> statement-breakpoint
DROP INDEX IF EXISTS "console_contract_signature_party_unique";
