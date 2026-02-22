-- Migration 0004: Add Stripe customer ID to users table
--
-- Bridges RevealUI session auth with Stripe billing.
-- The stripe_customer_id links a RevealUI user to their Stripe customer record.
-- Required for the Pro tier billing pipeline (checkout, portal, subscription management).

ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_stripe_customer_id_idx" ON "users" ("stripe_customer_id");
