-- GAP-444: entitlement source marker so gifted (grant) accounts do not pollute MRR.
-- stripe = Stripe webhook path; grant = admin CLI / manual gift; reconciler = heal path.
-- Default 'stripe' keeps existing paid rows honest; re-run grant-entitlement to mark comps.

ALTER TABLE "account_entitlements" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_source_check" CHECK (source IN ('stripe', 'grant', 'reconciler'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
