ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_visibility_check" CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
