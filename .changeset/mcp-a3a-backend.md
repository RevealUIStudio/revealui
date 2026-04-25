---
'@revealui/db': minor
'@revealui/ai': minor
---

A.3a of the post-v1 MCP arc — backend for the `/admin/mcp` Usage tab.

The accompanying A.3b PR adds the admin UI on top of this; A.3a lands
the schema migration + sink-side population + aggregation endpoint
independently so the UI can ship against a stable backend.

**`@revealui/db`:**
- Migration `0011_usage_meters_duration_ms.sql` adds two nullable
  columns to `usage_meters`: `duration_ms` (bigint) + `errored`
  (boolean). Pre-A.3 rows carry NULL; post-migration rows populate
  from the Stage 6.1/6.2 sinks.
- Drizzle schema mirror in `accounts.ts`.

**`@revealui/ai`:**
- Extend `McpUsageMeterRow` with `durationMs?: number` + `errored?: boolean`.
- `createUsageMeterSink` populates both from `event.duration_ms` /
  `!event.success` so existing consumers automatically capture the
  new fields once the schema accepts them.

**`api`:**
- New `GET /api/mcp/usage?range=24h|7d|30d` endpoint that aggregates
  per-`meterName` totals + success/error/unknown counts +
  p50/p95 duration via PostgreSQL `percentile_disc`. Filters by
  `entitlementMiddleware`-resolved `accountId` (account-scoped, same
  precedent as A.1's metering writer). Mounted at canonical +
  `/api/v1/...` paths.
- 9 PGlite-backed integration tests cover auth, accountId scoping,
  per-meter aggregation, percentile correctness, range filtering,
  and zod validation.
