ALTER TABLE "review_controller_shadow_observations" ADD COLUMN "outcome_sha256" text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
DROP INDEX "review_controller_observation_delivery_pr_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "review_controller_observation_delivery_pr_unique" ON "review_controller_shadow_observations" ("delivery_id", "pull_request", "outcome_sha256");
