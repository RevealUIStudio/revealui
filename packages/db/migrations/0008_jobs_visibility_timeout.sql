-- Custom migration: visibility-timeout columns on jobs for durable work queue
-- (CR8-P2-01 phase A).
--
-- Extends the existing jobs table with three columns needed by the native
-- worker loop:
--   * locked_by       — worker identity (per-invocation UUID) that holds the claim
--   * locked_until    — visibility timeout; when NULL the row is unclaimed, when
--                       past-now the claim is stale and the cron safety-net
--                       (phase B) will reset the row to 'created'
--   * last_error      — latest failure message, surfaced in the DLQ view without
--                       having to dig into the output JSONB
--
-- The partial index supports the stall-reclaim query (cron phase B) and keeps
-- index size small since most rows are not in the 'active' state.
--
-- All statements idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
-- EXISTS) so reruns are no-ops.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "locked_by" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "last_error" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_locked_until_idx"
  ON "jobs" ("locked_until")
  WHERE state = 'active';
