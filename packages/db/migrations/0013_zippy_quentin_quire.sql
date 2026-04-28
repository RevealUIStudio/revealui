ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "devkit_profile" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "users" ADD CONSTRAINT "users_devkit_profile_check" CHECK (devkit_profile IS NULL OR devkit_profile IN ('agents', 'claude', 'cursor', 'revealui', 'zed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
