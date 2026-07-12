-- Migration: widen account_entitlements status + add last_event_at bookkeeping.
--
-- WHY (D1): account_entitlements_status_check omitted 'trialing', but the
-- customer.subscription.created handler writes the raw subscription.status
-- ('trialing') into the entitlement upsert. Every trial checkout's entitlement
-- INSERT threw a check violation, so paying trial customers got no entitlement
-- row. account_subscriptions already allows 'trialing'; this aligns the two
-- vocabularies and matches the read path (isHealthyStatus branches on it).
--
-- WHY (D2): last_event_at records the Stripe event.created that last mutated
-- each row, so the out-of-order staleness guard compares event-to-event on
-- Stripe's clock instead of local wall-clock updated_at vs event.created (which
-- always judged the second event in a burst "stale"). Nullable: pre-existing
-- rows carry no recorded event and always pass the guard.
--
-- IDEMPOTENCY: DROP CONSTRAINT IF EXISTS + duplicate_object guard + ADD COLUMN
-- IF NOT EXISTS make this safe to re-run against a DB that already has the
-- widened constraint or the columns.

ALTER TABLE "account_entitlements" DROP CONSTRAINT IF EXISTS "account_entitlements_status_check";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_status_check" CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired', 'revoked'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD COLUMN IF NOT EXISTS "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_entitlements" ADD COLUMN IF NOT EXISTS "last_event_at" timestamp with time zone;
