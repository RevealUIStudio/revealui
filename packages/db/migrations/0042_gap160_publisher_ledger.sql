-- GAP-160: publisher earnings ledger + weekly Connect payouts.
-- Forward only. Idempotent CREATE so a re-applied journal does not wipe rows.
-- amount_usd_cents is insert-only at the application layer (payout updates change status, never the amount).
-- One paid payout per publisher per week (partial unique index). A failed row does not block the next attempt.

CREATE TABLE IF NOT EXISTS "publisher_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"week_start" text NOT NULL,
	"stripe_transfer_id" text,
	"amount_usd_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"earning_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_at" timestamp with time zone,
	CONSTRAINT "publisher_payouts_status_check" CHECK (status IN ('pending', 'paid', 'failed')),
	CONSTRAINT "publisher_payouts_amount_nonneg_check" CHECK (amount_usd_cents >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "publisher_earnings" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"agent_id" text,
	"task_id" text NOT NULL,
	"amount_usd_cents" integer NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"payable_at" timestamp with time zone NOT NULL,
	"payout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publisher_earnings_task_id_uq" UNIQUE("task_id"),
	CONSTRAINT "publisher_earnings_status_check" CHECK (status IN ('accrued', 'held_for_dispute', 'released_to_payout', 'paid', 'dropped')),
	CONSTRAINT "publisher_earnings_amount_nonneg_check" CHECK (amount_usd_cents >= 0)
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "publisher_payouts" ADD CONSTRAINT "publisher_payouts_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "publisher_earnings" ADD CONSTRAINT "publisher_earnings_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "publisher_earnings" ADD CONSTRAINT "publisher_earnings_agent_id_marketplace_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."marketplace_agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "publisher_earnings" ADD CONSTRAINT "publisher_earnings_task_id_task_submissions_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "publisher_earnings" ADD CONSTRAINT "publisher_earnings_payout_id_publisher_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."publisher_payouts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "publisher_earnings_publisher_status_idx" ON "publisher_earnings" USING btree ("publisher_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publisher_earnings_payable_at_idx" ON "publisher_earnings" USING btree ("payable_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publisher_earnings_payout_id_idx" ON "publisher_earnings" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publisher_payouts_publisher_week_idx" ON "publisher_payouts" USING btree ("publisher_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "publisher_payouts_publisher_week_paid_uq" ON "publisher_payouts" USING btree ("publisher_id","week_start") WHERE status = 'paid';
