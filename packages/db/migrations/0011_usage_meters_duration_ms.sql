-- A.3 of the post-v1 MCP arc: add nullable `duration_ms` + `errored`
-- columns to `usage_meters` so the new `/admin/mcp` Usage tab can plot
-- p50/p95 duration buckets per `meterName` and compute success rate.
--
-- Backfill semantics:
--   - Existing rows (written by A.1 / A.2a / A.2b-backend before this
--     migration) get NULL on both columns and are excluded from
--     p-bucket / success-rate queries by `WHERE duration_ms IS NOT NULL`
--     / `WHERE errored IS NOT NULL` filters.
--   - New rows after this migration carry duration + errored populated
--     by the Stage 6.1 / 6.2 sinks, which compute `event.duration_ms`
--     and `!event.success` at adapter exit (see
--     `@revealui/ai/tools/mcp-events.ts`).
--
-- No index is added on `duration_ms` / `errored` directly — A.3 queries
-- always filter by `(account_id, period_start)` first (existing
-- composite index `usage_meters_account_period_idx`); the new columns
-- are only used in aggregation buckets after the row set is narrowed.

ALTER TABLE "usage_meters"
  ADD COLUMN IF NOT EXISTS "duration_ms" bigint;
--> statement-breakpoint
ALTER TABLE "usage_meters"
  ADD COLUMN IF NOT EXISTS "errored" boolean;
