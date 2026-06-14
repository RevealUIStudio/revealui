DROP INDEX "billing_catalog_plan_id_idx";--> statement-breakpoint
ALTER TABLE "billing_catalog" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_catalog_plan_id_mode_idx" ON "billing_catalog" USING btree ("plan_id","mode");--> statement-breakpoint
CREATE INDEX "billing_catalog_mode_idx" ON "billing_catalog" USING btree ("mode");--> statement-breakpoint
ALTER TABLE "billing_catalog" ADD CONSTRAINT "billing_catalog_mode_check" CHECK (mode IN ('live', 'test'));