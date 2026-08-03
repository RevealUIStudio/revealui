-- GAP-448 Phase 2: kit_fulfillments for Agency Founding Kit stamp-on-payment.
-- Hand-written (scoped CREATE; meta snapshot lag precedent 0034).

CREATE TABLE IF NOT EXISTS "kit_fulfillments" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"license_id" text,
	"user_id" text,
	"customer_id" text NOT NULL,
	"tier" text DEFAULT 'max' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"artifact_mode" text DEFAULT 'thin' NOT NULL,
	"branding" jsonb NOT NULL,
	"artifact" jsonb,
	"error" text,
	"livemode" text DEFAULT 'test' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kit_fulfillments_status_check" CHECK (status IN ('queued', 'running', 'awaiting_branding', 'ready', 'failed')),
	CONSTRAINT "kit_fulfillments_artifact_mode_check" CHECK (artifact_mode IN ('thin', 'full'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kit_fulfillments" ADD CONSTRAINT "kit_fulfillments_license_id_licenses_id_fk"
  FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kit_fulfillments" ADD CONSTRAINT "kit_fulfillments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kit_fulfillments_stripe_event_id_uidx"
  ON "kit_fulfillments" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_license_id_idx"
  ON "kit_fulfillments" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_user_id_idx"
  ON "kit_fulfillments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_status_idx"
  ON "kit_fulfillments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_customer_id_idx"
  ON "kit_fulfillments" USING btree ("customer_id");
