-- GAP-162: USDC-on-Base payment attempts, one refund row per attempt, and disputes.
-- Forward only. Idempotent CREATE. RevealCoin is not an asset on these tables.
-- amount columns are insert-only at the application layer.

CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"task_id" text NOT NULL,
	"amount_usdc" text NOT NULL,
	"asset" text DEFAULT 'usdc-base' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"attempt_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_task_attempt_uq" UNIQUE("task_id","attempt_no"),
	CONSTRAINT "payment_attempts_status_check" CHECK (status IN ('paid', 'not_charged')),
	CONSTRAINT "payment_attempts_asset_check" CHECK (asset = 'usdc-base'),
	CONSTRAINT "payment_attempts_attempt_no_check" CHECK (attempt_no >= 1)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "revmarket_refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_attempt_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"task_id" text NOT NULL,
	"reason" text NOT NULL,
	"kind" text NOT NULL,
	"amount_usdc" text NOT NULL,
	"amount_usd_cents" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revmarket_refunds_attempt_uq" UNIQUE("payment_attempt_id"),
	CONSTRAINT "revmarket_refunds_kind_check" CHECK (kind IN ('auto_fail', 'cancel', 'dispute', 'cap_held')),
	CONSTRAINT "revmarket_refunds_status_check" CHECK (status IN ('auto', 'awaiting_joshua')),
	CONSTRAINT "revmarket_refunds_amount_nonneg_check" CHECK (amount_usd_cents >= 0)
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "revmarket_disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_reason" text NOT NULL,
	"publisher_reply" text,
	"joshua_decision" text DEFAULT 'pending' NOT NULL,
	"abuse_flag" boolean DEFAULT false NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "revmarket_disputes_task_uq" UNIQUE("task_id"),
	CONSTRAINT "revmarket_disputes_decision_check" CHECK (joshua_decision IN ('pending', 'refund', 'deny'))
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_task_id_task_submissions_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "revmarket_refunds" ADD CONSTRAINT "revmarket_refunds_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "revmarket_refunds" ADD CONSTRAINT "revmarket_refunds_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "revmarket_refunds" ADD CONSTRAINT "revmarket_refunds_task_id_task_submissions_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "revmarket_disputes" ADD CONSTRAINT "revmarket_disputes_task_id_task_submissions_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "revmarket_disputes" ADD CONSTRAINT "revmarket_disputes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_attempts_customer_idx" ON "payment_attempts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revmarket_refunds_customer_created_idx" ON "revmarket_refunds" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revmarket_disputes_customer_opened_idx" ON "revmarket_disputes" USING btree ("customer_id","opened_at");
