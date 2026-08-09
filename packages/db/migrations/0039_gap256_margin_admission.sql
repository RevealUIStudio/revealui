-- GAP-256 PR-1: margin snapshots, per-account daily rollup, admission waitlist,
-- COGS breaker columns on account_entitlements, and source='signup' on entitlements.
-- Hand-written for IF NOT EXISTS / DO $$ constraint idempotency (hand-written allowlist).
-- Companion Drizzle schema: packages/db/src/schema/margin-admission.ts + accounts.ts.

-- ---------------------------------------------------------------------------
-- margin_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "margin_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "period_date" date NOT NULL,
  "free_cost_cents" bigint DEFAULT 0 NOT NULL,
  "paid_cost_cents" bigint DEFAULT 0 NOT NULL,
  "total_cost_cents" bigint DEFAULT 0 NOT NULL,
  "revenue_cents" bigint DEFAULT 0 NOT NULL,
  "net_cents" bigint DEFAULT 0 NOT NULL,
  "projected_7d_cents" bigint,
  "free_cost_ratio" text,
  "mode" text DEFAULT 'open' NOT NULL,
  "rates" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "trend" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "account_count_free" integer,
  "account_count_paid" integer,
  "computed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "margin_snapshots_period_date_uidx"
  ON "margin_snapshots" USING btree ("period_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "margin_snapshots_computed_at_idx"
  ON "margin_snapshots" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "margin_snapshots_mode_idx"
  ON "margin_snapshots" USING btree ("mode");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "margin_snapshots" ADD CONSTRAINT "margin_snapshots_mode_check"
  CHECK (mode IN ('open', 'lean', 'waitlist'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- account_margin_daily
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "account_margin_daily" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "period_date" date NOT NULL,
  "cost_cents" bigint DEFAULT 0 NOT NULL,
  "agent_tasks" bigint DEFAULT 0 NOT NULL,
  "revenue_cents" bigint DEFAULT 0 NOT NULL,
  "tier" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_margin_daily" ADD CONSTRAINT "account_margin_daily_account_id_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_margin_daily_account_period_uidx"
  ON "account_margin_daily" USING btree ("account_id", "period_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_margin_daily_period_date_idx"
  ON "account_margin_daily" USING btree ("period_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_margin_daily_account_id_idx"
  ON "account_margin_daily" USING btree ("account_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- admission_waitlist (NOT marketing waitlist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "admission_waitlist" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "token_hash" text NOT NULL,
  "snapshot_id" text,
  "mode_at_enqueue" text DEFAULT 'waitlist' NOT NULL,
  "position" integer,
  "source" text DEFAULT 'free_signup' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "invited_at" timestamp with time zone,
  "converted_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_waitlist_status_created_idx"
  ON "admission_waitlist" USING btree ("status", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_waitlist_email_idx"
  ON "admission_waitlist" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admission_waitlist_email_pending_uidx"
  ON "admission_waitlist" USING btree ("email")
  WHERE status = 'pending';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_waitlist" ADD CONSTRAINT "admission_waitlist_status_check"
  CHECK (status IN ('pending', 'invited', 'converted', 'cancelled', 'expired'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- account_entitlements: COGS breaker SSOT columns
-- ---------------------------------------------------------------------------
ALTER TABLE "account_entitlements"
  ADD COLUMN IF NOT EXISTS "cogs_breaker_tripped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_entitlements"
  ADD COLUMN IF NOT EXISTS "cogs_breaker_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_entitlements_cogs_breaker_tripped_at_idx"
  ON "account_entitlements" USING btree ("cogs_breaker_tripped_at");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- account_entitlements: allow source = 'signup' (free@t0 + paid-pending)
-- ---------------------------------------------------------------------------
ALTER TABLE "account_entitlements" DROP CONSTRAINT IF EXISTS "account_entitlements_source_check";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_source_check"
  CHECK (source IN ('stripe', 'grant', 'reconciler', 'signup'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
