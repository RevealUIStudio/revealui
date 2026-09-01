-- Studio-owned leads pipeline (not a vendor CRM, not a public SKU).
-- Hand-written for IF NOT EXISTS / DO $$ constraint idempotency (snapshot debt).
-- Companion Drizzle schema: packages/db/src/schema/leads.ts

CREATE TABLE IF NOT EXISTS "leads" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "company" text,
  "source" text DEFAULT 'manual' NOT NULL,
  "status" text DEFAULT 'lead' NOT NULL,
  "notes" text,
  "intro_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_status_idx"
  ON "leads" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_status_check"
  CHECK (status IN ('lead', 'intro_booked', 'intro_done', 'pilot', 'launch', 'closed'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_source_check"
  CHECK (source IN ('agency', 'marketing', 'manual'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
