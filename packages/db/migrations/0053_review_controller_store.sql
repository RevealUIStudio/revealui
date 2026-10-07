CREATE TABLE "review_controller_shadow_observations" (
	"observation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" text NOT NULL,
	"event_kind" text NOT NULL,
	"repository_id" bigint NOT NULL,
	"pull_request" integer,
	"head_sha" text NOT NULL,
	"head_tree_sha" text NOT NULL,
	"base_sha" text,
	"base_tree_sha" text,
	"manifest_sha256" text,
	"file_count" integer,
	"check_runs" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_controller_observation_repository_positive" CHECK ("review_controller_shadow_observations"."repository_id" > 0),
	CONSTRAINT "review_controller_observation_event_kind" CHECK ("review_controller_shadow_observations"."event_kind" IN ('pull_request', 'merge_group')),
	CONSTRAINT "review_controller_observation_shape" CHECK ((
      ("review_controller_shadow_observations"."event_kind" = 'pull_request' AND "review_controller_shadow_observations"."pull_request" IS NOT NULL AND "review_controller_shadow_observations"."base_sha" IS NOT NULL
        AND "review_controller_shadow_observations"."base_tree_sha" IS NOT NULL AND "review_controller_shadow_observations"."manifest_sha256" IS NOT NULL AND "review_controller_shadow_observations"."file_count" IS NOT NULL)
      OR
      ("review_controller_shadow_observations"."event_kind" = 'merge_group' AND "review_controller_shadow_observations"."pull_request" IS NULL AND "review_controller_shadow_observations"."base_sha" IS NOT NULL
        AND "review_controller_shadow_observations"."base_tree_sha" IS NULL AND "review_controller_shadow_observations"."manifest_sha256" IS NULL AND "review_controller_shadow_observations"."file_count" IS NULL)
    )),
	CONSTRAINT "review_controller_observation_manifest_nonnegative" CHECK ("review_controller_shadow_observations"."file_count" IS NULL OR "review_controller_shadow_observations"."file_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "review_controller_signed_receipts" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"repository_id" bigint NOT NULL,
	"pull_request" integer NOT NULL,
	"head_sha" text NOT NULL,
	"base_sha" text NOT NULL,
	"candidate_tree_sha" text NOT NULL,
	"policy_version" text NOT NULL,
	"key_id" text NOT NULL,
	"envelope_sha256" text NOT NULL,
	"canonical_envelope" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_controller_receipt_repository_positive" CHECK ("review_controller_signed_receipts"."repository_id" > 0),
	CONSTRAINT "review_controller_receipt_pull_request_positive" CHECK ("review_controller_signed_receipts"."pull_request" > 0),
	CONSTRAINT "review_controller_receipt_head_sha" CHECK ("review_controller_signed_receipts"."head_sha" ~ '^[a-f0-9]{40,64}$'),
	CONSTRAINT "review_controller_receipt_base_sha" CHECK ("review_controller_signed_receipts"."base_sha" ~ '^[a-f0-9]{40,64}$'),
	CONSTRAINT "review_controller_receipt_candidate_sha" CHECK ("review_controller_signed_receipts"."candidate_tree_sha" ~ '^[a-f0-9]{40,64}$'),
	CONSTRAINT "review_controller_receipt_envelope_sha" CHECK ("review_controller_signed_receipts"."envelope_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "review_controller_receipt_expiry" CHECK ("review_controller_signed_receipts"."expires_at" > "review_controller_signed_receipts"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "review_controller_webhook_inbox" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"installation_id" bigint NOT NULL,
	"repository_id" bigint NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"lease_token" uuid,
	"last_error_code" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "review_controller_webhook_ids_positive" CHECK ("review_controller_webhook_inbox"."installation_id" > 0 AND "review_controller_webhook_inbox"."repository_id" > 0),
	CONSTRAINT "review_controller_webhook_state_valid" CHECK ("review_controller_webhook_inbox"."state" IN ('pending', 'processing', 'completed', 'failed')),
	CONSTRAINT "review_controller_webhook_attempts_nonnegative" CHECK ("review_controller_webhook_inbox"."attempts" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "review_controller_shadow_observations" ADD CONSTRAINT "review_controller_shadow_observations_delivery_id_review_controller_webhook_inbox_delivery_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."review_controller_webhook_inbox"("delivery_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "review_controller_observation_delivery_pr_unique" ON "review_controller_shadow_observations" USING btree ("delivery_id","pull_request");--> statement-breakpoint
CREATE UNIQUE INDEX "review_controller_merge_group_delivery_idx" ON "review_controller_shadow_observations" USING btree ("delivery_id") WHERE "review_controller_shadow_observations"."event_kind" = 'merge_group';--> statement-breakpoint
CREATE INDEX "review_controller_shadow_candidate_idx" ON "review_controller_shadow_observations" USING btree ("repository_id","pull_request","head_sha","base_sha","observed_at");--> statement-breakpoint
CREATE INDEX "review_controller_receipt_candidate_idx" ON "review_controller_signed_receipts" USING btree ("repository_id","pull_request","head_sha","base_sha","candidate_tree_sha","issued_at");--> statement-breakpoint
CREATE INDEX "review_controller_inbox_pending_idx" ON "review_controller_webhook_inbox" USING btree ("next_attempt_at","received_at","delivery_id") WHERE "review_controller_webhook_inbox"."state" IN ('pending', 'failed');
