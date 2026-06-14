DROP INDEX IF EXISTS "billing_catalog_plan_id_idx";--> statement-breakpoint
ALTER TABLE "billing_catalog" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_catalog_plan_id_mode_idx" ON "billing_catalog" USING btree ("plan_id","mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_catalog_mode_idx" ON "billing_catalog" USING btree ("mode");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_catalog" ADD CONSTRAINT "billing_catalog_mode_check" CHECK (mode IN ('live', 'test'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
