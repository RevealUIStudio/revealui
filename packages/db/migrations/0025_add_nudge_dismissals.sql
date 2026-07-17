-- Migration: add nudge_dismissals (GAP-300 §7 in-product nudge surface).
--
-- WHY: server-tracked per-user-per-nudge snooze state for the BeforeDashboard
-- nudge surface, replacing the OnboardingChecklist's localStorage kill-switch
-- pattern that §1 flags as wrong for a "returns after dismissal" nudge.
--
-- Hand-written because `packages/db/migrations/meta/` is missing snapshots
-- for 0021-0024 (pre-existing debt, unrelated to this change — see
-- meta/_custom.json), so `drizzle-kit generate` diffs against the stale
-- 0020 snapshot and bundles in unrelated drift (kg_* tables already created
-- by 0021/0022, and the 0023/0024 CHECK/column changes). This migration is
-- scoped to only the new table, following the 0010/0021 precedent for a
-- hand-written CREATE TABLE.
--
-- IDEMPOTENCY: CREATE TABLE IF NOT EXISTS, DO $$ ADD CONSTRAINT ... EXCEPTION
-- WHEN duplicate_object for the FK, CREATE INDEX IF NOT EXISTS (0014/0023/0024
-- precedent).

CREATE TABLE IF NOT EXISTS "nudge_dismissals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nudge_id" text NOT NULL,
	"dismiss_count" integer DEFAULT 1 NOT NULL,
	"last_dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nudge_dismissals_dismiss_count_check" CHECK (dismiss_count BETWEEN 1 AND 2)
);
--> statement-breakpoint
ALTER TABLE "nudge_dismissals" DROP CONSTRAINT IF EXISTS "nudge_dismissals_user_id_users_id_fk";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nudge_dismissals" ADD CONSTRAINT "nudge_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nudge_dismissals_user_nudge_idx" ON "nudge_dismissals" USING btree ("user_id","nudge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nudge_dismissals_user_id_idx" ON "nudge_dismissals" USING btree ("user_id");
