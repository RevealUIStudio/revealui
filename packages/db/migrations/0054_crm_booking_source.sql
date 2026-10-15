ALTER TABLE "crm_booking_links" ALTER COLUMN "site_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_booking_links" ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb;