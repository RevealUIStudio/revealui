# MCP Maintenance Guide

This document consolidates all MCP-related maintenance information including CRDT audit strategy, key decisions, migration procedures, and metrics/observability approach.

---

## Table of Contents

1. [Decision Log](#decision-log)
2. [CRDT Audit](#crdt-audit)
3. [Migration Checklist](#migration-checklist)
4. [Metrics & Observability](#metrics--observability)

---

## Decision Log

### MCP Decision — pglite (ElectricSQL) + Logs‑First Metrics

**TL;DR** — Default to ElectricSQL (`pglite`) for local development to get Postgres parity, CRDT sync, and smooth production migration. Start observability with a logs‑first approach (`MCP_METRICS_MODE=logs`). Provide a documented migration path to managed Postgres + `pgvector` for production, and TODOs to add Prometheus + Grafana later.

#### Why `pglite` (ElectricSQL)

- Local Postgres parity: preserves SQL semantics developers expect while providing Electric sync.
- CRDT & sync primitives: built-in conflict resolution and metadata for replicated state.
- Smooth prod path: same logical model maps to managed Postgres (Neon / Supabase) with minimal code changes.

#### Default configuration

- `MCP_PERSISTENCE_DRIVER=pglite` (dev default)
- `ELECTRIC_DATABASE_URL=` (placeholder for local pglite path/URL)
- `MCP_METRICS_MODE=logs`

#### Local vector testing

- Use a compose variant with local Postgres + `pgvector` when testing vector queries or index behavior. `pglite` remains the default for state and CRDT behavior.

#### Security stance

- Never commit credentials. Use `packages/mcp/.env.example` with placeholders only.
- Store `ELECTRIC_DATABASE_URL`, `ELECTRIC_API_KEY`, `PROD_DATABASE_URL` in CI secrets or Vault for staging/prod.

#### Migration path (dev → prod)

- Dev: `pglite` (local ElectricSQL)
- Stage: Local Postgres with `pgvector` + Electric sync metadata
- Prod: Managed Postgres (enable `pgvector`), Electric sync metadata preserved

(See [Migration Checklist](#migration-checklist) section for a detailed plan.)

#### Observability

- Start with logs-first metrics (Option C). Emit structured log events for conflicts, merges, and error rates.
- TODO: add Prometheus + Grafana manifests under `packages/mcp/k8s/` when operational budget permits.

#### TODOs (short)

- Add `packages/mcp/docker-compose.yml` with `pglite` dev service and `postgres+pgvector` variant.
- Add `packages/mcp/src/adapters/db.ts` with `connectPglite()` / `connectPostgres()`.
- Add CRDT migrations & backfill scripts.
- Add integration tests that spin up compose and validate CRDT merges.
- Add `packages/mcp/metrics.md` (logs-first) and TODOs for Option A (Prometheus + Grafana).

---

## CRDT Audit

### CRDT Audit — Candidate Entities & Strategy

**Goal** — ensure all replicated, collaborative, or concurrent state uses CRDT semantics to avoid manual conflict resolution.

#### Scope

- Applies to MCP persistence: local `pglite` (dev) and managed Postgres (prod).
- Targets entity categories that are concurrently updated or replicated.

#### Candidate entities and recommended CRDT types

- `documents` / `shared_documents`
  - Use: collaborative edits
  - CRDT: delta CRDT (RGA / JSON CRDT / operation-based)
  - Policy: preserve operations and causal order
- `subscription_state` / `cursors`
  - Use: client offsets, cursors
  - CRDT: LWW register or monotonic counter
  - Policy: LWW with server-side monotonic enforcement where possible
- `presence` / `ephemeral_status`
  - Use: frequent transient updates
  - CRDT: OR-Set with TTL or presence map
  - Policy: TTL-based garbage collection
- `message_ack` / `delivered_acks`
  - Use: dedup across replicas
  - CRDT: OR-Set or G-Set with tombstones
  - Policy: idempotent ack addition, compact tombstones periodically
- `user_settings` / `shared_settings`
  - Use: small multi-client updates
  - CRDT: observed-remove map / JSON CRDT
  - Policy: field-level merge, operator override protected

#### Implementation notes

- Adapter responsibilities:
  - `connectPglite()` should declare CRDT columns via Electric APIs (where available).
  - `connectPostgres()` must keep Electric metadata columns and map CRDT metadata to Postgres-compatible storage.
- Schema:
  - Add `_electric_meta` or `_crdt_meta` columns near payloads.
  - Store operation deltas if possible for efficient merges.
- Rollout:
  - Feature-flag per-entity CRDT enablement for staged rollout.
  - Small-sample backfills prior to full backfill.
- Storage & compaction:
  - Implement delta compaction for large-delta CRDTs.
  - Schedule periodic compaction jobs to remove tombstones and shrink op logs.

#### Testing

- Unit tests: CRDT op merges for each primitive (OR-Set, PNCounter, LWW register).
- Integration tests: concurrent writers with `pglite` stack asserting deterministic merged state.
- Migration tests: backfill scripts run on sample data and validate checksum diffs.

#### Risk & mitigation

- Existing payload types incompatible with CRDT fields — use non-destructive migrations and backfill.
- Vector index (pgvector) mapping must be preserved during schema changes — treat embedding columns as orthogonal.

#### Suggested tests to add

- `packages/mcp/__tests__/crdt.unit.test.ts` — unit semantics.
- `packages/mcp/__tests__/crdt.integration.test.ts` — compose-based concurrent writes.

---

## Migration Checklist

### MCP Migration Checklist — pglite → Managed Postgres + pgvector

**Goal** — safely cut over from `pglite` dev workflows to managed Postgres in production while preserving CRDT semantics and vector index integrity.

#### Pre‑reqs

- Staging Postgres provisioned with `pgvector` enabled.
- Backups and CI/Vault secrets available: `ELECTRIC_DATABASE_URL`, `ELECTRIC_API_KEY`, `PROD_DATABASE_URL`.
- Smoke test harness and CRDT integration tests present.

#### Ordered checklist

1. **Backup source DB**
```bash
pg_dump -Fc -f backup.before.mcp.dump "$CURRENT_DB_URL"
```

2. **Provision staging DB with `pgvector`**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. **Apply schema migrations to staging (include CRDT metadata columns)**
- Add migration files: `packages/mcp/migrations/0001_add_crdt_columns.sql` and rollback script.

4. **Small backfill (sample subset)**
- Run `packages/mcp/migrations/backfill_crdt_meta.js` for representative rows; validate merges.

5. **Run integration smoke tests**
- Execute CRDT integration test suite against staging.

6. **Export/import full snapshot (if migrating data)**
```bash
pg_restore -d "$STAGING_DB_URL" backup.before.mcp.dump
```

7. **Create `pgvector` indexes (maintenance window suggested)**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

8. **Full backfill & compaction**
- Run full backfill; compact delta-CRDT ops as needed.

9. **Switch app config (canary first)**
- Set `MCP_PERSISTENCE_DRIVER=postgres`
- Update `ELECTRIC_DATABASE_URL` to prod managed DB via secrets

10. **Canary / canary tests**
- Route small traffic, monitor conflict events and query correctness.

11. **Full cutover**
- Promote config change to all instances.

12. **Post-migration validation**
- Run full test suite, verify vector results, verify merge/conflict telemetry.

13. **Rollback readiness**
```bash
pg_restore -d "$PROD_DB_URL" backup.before.mcp.dump
```

#### Operational notes

- Prefer online migration with feature flags and small maintenance windows for index builds.
- Validate checksums and sample-row diffs after every major migration step.
- Keep rollback scripts next to each migration file.

---

## Metrics & Observability

### MCP Metrics & Observability — Logs‑First (Option C)

#### Decision

- Start with logs-first metrics to avoid hosted monitoring costs and reduce infra.
- Emit structured logs for conflicts, merges, errors, and key latencies.
- Provide clear TODOs and skeletons to add Prometheus + Grafana later.

#### Env & modes

- `MCP_METRICS_MODE=logs` (default)
- Other modes: `otel` (collector), `prometheus` (future Option A)

#### Structured log schema (recommended JSON fields)

- `timestamp`
- `service = "mcp"`
- `event` = `conflict|merge|error|operation`
- `entity` = `documents|cursors|presence|...`
- `entity_id`
- `op_type` = `write|merge|backfill|index`
- `details` = short summary
- `duration_ms`
- `trace_id` (optional)

#### Conflict/merge logging example (concept)

- Log a `conflict` event when CRDT merge produces non-trivial resolution; include `before`, `ops_count`, `merged_summary`.

#### Log collection options (free)

- Use file logs + `loki` (self-hosted) and Grafana Loki datasource for queries (both OSS).
- Or aggregate logs to a central file/CI artifact and analyze with `rg`/`jq` for small teams.

#### Quick local setup (suggested)

- Start compose with `loki` (optional) to collect logs, or rely on local file logs.
```bash
docker-compose -f packages/mcp/docker-compose.yml up -d loki
```

#### TODOs for Option A (Prometheus + Grafana)

- Add `packages/mcp/k8s/` manifests and Helm chart scaffolding for Prometheus exporters and Grafana dashboards.
- Instrument code with Prometheus client metrics (conflict counters, merge latencies).
- Add dashboards and alert rules for high conflict rates.

#### Implementation guidance

- Implement `packages/mcp/src/telemetry.ts` that:
  - Emits structured logs for every conflict/merge.
  - In `MCP_METRICS_MODE=logs`, write JSON lines to stdout and rotate to file if needed.
- Provide quick grep/jq scripts in `packages/mcp/` to extract conflict rates.

#### Security & privacy

- Avoid logging sensitive payloads (mask user PII).
- Keep telemetry ingestion endpoints protected; local logs are preferred during dev.
