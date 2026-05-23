CREATE TABLE IF NOT EXISTS "agent_credit_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tasks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processed_webhook_events" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "processed_webhook_events" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_credit_events" ADD CONSTRAINT "agent_credit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_status_claimed_idx" ON "processed_webhook_events" USING btree ("status","claimed_at");