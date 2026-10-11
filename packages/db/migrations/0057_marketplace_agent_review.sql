-- Listing review: store a license and allow the existing pending status.
-- pending matches marketplace server listings (submitted, not public).
-- Hand-written so generate does not re-emit unrelated snapshot drift.

ALTER TABLE "marketplace_agents" ADD COLUMN IF NOT EXISTS "license" text;
--> statement-breakpoint
ALTER TABLE "marketplace_agents" DROP CONSTRAINT IF EXISTS "marketplace_agents_status_check";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_status_check" CHECK (status IN ('draft', 'pending', 'published', 'suspended', 'deprecated'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
