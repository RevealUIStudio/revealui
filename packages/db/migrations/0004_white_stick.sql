ALTER TABLE "user_devices" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "user_devices" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_devices" ADD COLUMN "token_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "npm_username" text;