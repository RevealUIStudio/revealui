-- GAP-448 Phase 2-A follow-on: thin package `artifact` jsonb + customer index.
-- 0035 (P2-1 #2393) created kit_fulfillments without the artifact column.
-- Additive only; safe on DBs that already applied 0035.

ALTER TABLE "kit_fulfillments" ADD COLUMN IF NOT EXISTS "artifact" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kit_fulfillments_customer_id_idx"
  ON "kit_fulfillments" USING btree ("customer_id");
