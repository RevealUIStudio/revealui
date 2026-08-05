-- GAP-175: propagate file reservation TTL to Neon coordination_file_claims.
-- Additive: nullable expires_at so existing rows remain valid until swept
-- (null = legacy; new dual-writes always set a concrete expiry).

ALTER TABLE "coordination_file_claims"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coordination_file_claims_expires_at_idx"
  ON "coordination_file_claims" USING btree ("expires_at");
