ALTER TABLE "account_entitlements" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
CREATE INDEX "account_entitlements_mode_idx" ON "account_entitlements" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "account_subscriptions_mode_idx" ON "account_subscriptions" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "licenses_mode_idx" ON "licenses" USING btree ("mode");--> statement-breakpoint
ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_mode_check" CHECK (mode IN ('live', 'test'));--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD CONSTRAINT "account_subscriptions_mode_check" CHECK (mode IN ('live', 'test'));--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_mode_check" CHECK (mode IN ('live', 'test'));