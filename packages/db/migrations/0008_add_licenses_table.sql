-- Migration 0008: Add licenses table
--
-- Stores generated license keys for Pro/Enterprise customers.
-- License keys are JWTs signed with REVEALUI_LICENSE_PRIVATE_KEY.
-- Generated on Stripe checkout.session.completed and stored here for
-- retrieval, auditing, and revocation.
--
-- Referenced by: apps/api/src/routes/webhooks.ts (checkout, subscription events)
--                apps/api/src/routes/billing.ts (GET /api/billing/subscription)

CREATE TABLE IF NOT EXISTS "licenses" (
  "id"              text PRIMARY KEY NOT NULL,
  "user_id"         text NOT NULL,
  "license_key"     text NOT NULL,
  "tier"            text NOT NULL,
  "subscription_id" text,
  "customer_id"     text NOT NULL,
  "status"          text NOT NULL DEFAULT 'active',
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at"      timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_customer_id_idx"     ON "licenses" ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_user_id_idx"         ON "licenses" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_status_idx"          ON "licenses" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_subscription_id_idx" ON "licenses" ("subscription_id");
