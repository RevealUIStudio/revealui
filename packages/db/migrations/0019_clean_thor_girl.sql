ALTER TABLE "account_entitlements" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_entitlements_mode_idx" ON "account_entitlements" USING btree ("mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_subscriptions_mode_idx" ON "account_subscriptions" USING btree ("mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_mode_idx" ON "licenses" USING btree ("mode");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_mode_check" CHECK (mode IN ('live', 'test'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_subscriptions" ADD CONSTRAINT "account_subscriptions_mode_check" CHECK (mode IN ('live', 'test'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "licenses" ADD CONSTRAINT "licenses_mode_check" CHECK (mode IN ('live', 'test'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
