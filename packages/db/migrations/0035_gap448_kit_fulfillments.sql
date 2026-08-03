-- GAP-448 Phase 2-A: kit_fulfillments for Agency Founding Kit stamp/deliver.
-- Hand-written CREATE (snapshot lag precedent: 0034_gap464_account_sso_providers).

CREATE TABLE IF NOT EXISTS "kit_fulfillments" (
"id" text PRIMARY KEY NOT NULL,
"stripe_event_id" text NOT NULL,
"license_id" text,
"user_id" text,
"customer_id" text NOT NULL,
"tier" text DEFAULT 'max' NOT NULL,
"status" text DEFAULT 'queued' NOT NULL,
"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
"artifact_uri" text,
"error" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "kit_fulfillments_status_check" CHECK (status IN ('queued', 'running', 'awaiting_branding', 'ready', 'failed'))
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
CREATE INDEX IF NOT EXISTS "kit_fulfillments_user_id_idx"
  ON "kit_fulfillments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_license_id_idx"
  ON "kit_fulfillments" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_status_idx"
  ON "kit_fulfillments" USING btree ("status");
