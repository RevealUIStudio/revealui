CREATE TABLE IF NOT EXISTS "lifecycle_emails_sent" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" text NOT NULL,
	"email_type" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lifecycle_emails_sent_email_type_check" CHECK (email_type IN ('day0_welcome', 'day1_checkin', 'day7_outcome')),
	CONSTRAINT "lifecycle_emails_sent_status_check" CHECK (status IN ('sent', 'dry_run')),
	CONSTRAINT "lifecycle_emails_sent_tier_check" CHECK (tier IN ('free', 'pro', 'max', 'enterprise'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lifecycle_emails_sent" ADD CONSTRAINT "lifecycle_emails_sent_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_emails_sent_idempotency_key_idx" ON "lifecycle_emails_sent" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lifecycle_emails_sent_user_id_idx" ON "lifecycle_emails_sent" USING btree ("user_id");
