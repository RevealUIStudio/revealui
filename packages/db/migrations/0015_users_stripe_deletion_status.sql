-- Migration: add stripe_deletion_status and stripe_deletion_at to users table
--
-- WHY: GDPR Article 17 (right to erasure) requires calling stripe.customers.del
-- when a user requests deletion. These columns record whether the Stripe-side
-- erasure succeeded or failed so ops can investigate failures and the audit
-- trail is complete. See I-2 in the Phase 1 payment audit.
--
-- IDEMPOTENCY: IF NOT EXISTS guards make this safe to re-run.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "stripe_deletion_status" text,
  ADD COLUMN IF NOT EXISTS "stripe_deletion_at" timestamp with time zone;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_stripe_deletion_status_check"
    CHECK (stripe_deletion_status IS NULL OR stripe_deletion_status IN ('deleted', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
