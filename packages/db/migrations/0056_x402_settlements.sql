-- Durable x402 settlement records.
-- The payment nonce is unique so the same signed authorization cannot be stored twice.
-- Hand-written: CREATE TABLE IF NOT EXISTS plus a unique index. The current snapshot
-- chain is not a clean generate base for this single table.

CREATE TABLE IF NOT EXISTS "x402_settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_nonce" text NOT NULL,
	"tx_hash" text NOT NULL,
	"amount" text NOT NULL,
	"payer" text NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x402_settlements_status_check" CHECK (status IN ('settled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "x402_settlements_payment_nonce_uidx" ON "x402_settlements" USING btree ("payment_nonce");
