# MCP Decision — pglite (ElectricSQL) + Logs‑First Metrics

TL;DR — Default to ElectricSQL (`pglite`) for local development to get Postgres parity, CRDT sync, and smooth production migration. Start observability with a logs‑first approach (`MCP_METRICS_MODE=logs`). Provide a documented migration path to managed Postgres + `pgvector` for production, and TODOs to add Prometheus + Grafana later.

Why `pglite` (ElectricSQL)
- Local Postgres parity: preserves SQL semantics developers expect while providing Electric sync.
- CRDT & sync primitives: built-in conflict resolution and metadata for replicated state.
- Smooth prod path: same logical model maps to managed Postgres (Neon / Supabase) with minimal code changes.

Default configuration
- `MCP_PERSISTENCE_DRIVER=pglite` (dev default)
- `ELECTRIC_DATABASE_URL=` (placeholder for local pglite path/URL)
- `MCP_METRICS_MODE=logs`

Local vector testing
- Use a compose variant with local Postgres + `pgvector` when testing vector queries or index behavior. `pglite` remains the default for state and CRDT behavior.

Security stance
- Never commit credentials. Use `mcp/.env.example` with placeholders only.
- Store `ELECTRIC_DATABASE_URL`, `ELECTRIC_API_KEY`, `PROD_DATABASE_URL` in CI secrets or Vault for staging/prod.

Migration path (dev → prod)
- Dev: `pglite` (local ElectricSQL)
- Stage: Local Postgres with `pgvector` + Electric sync metadata
- Prod: Managed Postgres (enable `pgvector`), Electric sync metadata preserved
(See `mcp/MIGRATION_CHECKLIST.md` for a detailed plan.)

Observability
- Start with logs-first metrics (Option C). Emit structured log events for conflicts, merges, and error rates.
- TODO: add Prometheus + Grafana manifests under `mcp/k8s/` when operational budget permits.

TODOs (short)
- Add `mcp/docker-compose.yml` with `pglite` dev service and `postgres+pgvector` variant.
- Add `packages/mcp/src/adapters/db.ts` with `connectPglite()` / `connectPostgres()`.
- Add CRDT migrations & backfill scripts.
- Add integration tests that spin up compose and validate CRDT merges.
- Add `mcp/metrics.md` (logs-first) and TODOs for Option A (Prometheus + Grafana).
