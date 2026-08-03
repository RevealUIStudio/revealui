-- GAP-448 P2-A: extend kit_fulfillments for stamp job (artifact_mode, artifact jsonb, livemode).
-- 0035 (#2393) created the base table with artifact_uri; handler stores package meta in artifact.

ALTER TABLE "kit_fulfillments" ADD COLUMN IF NOT EXISTS "artifact_mode" text DEFAULT 'thin' NOT NULL;--> statement-breakpoint
ALTER TABLE "kit_fulfillments" ADD COLUMN IF NOT EXISTS "artifact" jsonb;--> statement-breakpoint
ALTER TABLE "kit_fulfillments" ADD COLUMN IF NOT EXISTS "livemode" text DEFAULT 'test' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kit_fulfillments" ADD CONSTRAINT "kit_fulfillments_artifact_mode_check"
  CHECK (artifact_mode IN ('thin', 'full'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_customer_id_idx"
  ON "kit_fulfillments" USING btree ("customer_id");
