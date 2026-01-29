# MCP Metrics & Observability — Logs‑First (Option C)

Decision
- Start with logs-first metrics to avoid hosted monitoring costs and reduce infra.
- Emit structured logs for conflicts, merges, errors, and key latencies.
- Provide clear TODOs and skeletons to add Prometheus + Grafana later.

Env & modes
- `MCP_METRICS_MODE=logs` (default)
- Other modes: `otel` (collector), `prometheus` (future Option A)

Structured log schema (recommended JSON fields)
- `timestamp`
- `service = "mcp"`
- `event` = `conflict|merge|error|operation`
- `entity` = `documents|cursors|presence|...`
- `entity_id`
- `op_type` = `write|merge|backfill|index`
- `details` = short summary
- `duration_ms`
- `trace_id` (optional)

Conflict/merge logging example (concept)
- Log a `conflict` event when CRDT merge produces non-trivial resolution; include `before`, `ops_count`, `merged_summary`.

Log collection options (free)
- Use file logs + `loki` (self-hosted) and Grafana Loki datasource for queries (both OSS).
- Or aggregate logs to a central file/CI artifact and analyze with `rg`/`jq` for small teams.

Quick local setup (suggested)
- Start compose with `loki` (optional) to collect logs, or rely on local file logs.
```bash
docker-compose -f mcp/docker-compose.yml up -d loki
```

TODOs for Option A (Prometheus + Grafana)
- Add `mcp/k8s/` manifests and Helm chart scaffolding for Prometheus exporters and Grafana dashboards.
- Instrument code with Prometheus client metrics (conflict counters, merge latencies).
- Add dashboards and alert rules for high conflict rates.

Implementation guidance
- Implement `packages/mcp/src/telemetry.ts` that:
  - Emits structured logs for every conflict/merge.
  - In `MCP_METRICS_MODE=logs`, write JSON lines to stdout and rotate to file if needed.
- Provide quick grep/jq scripts in `mcp/` to extract conflict rates.

Security & privacy
- Avoid logging sensitive payloads (mask user PII).
- Keep telemetry ingestion endpoints protected; local logs are preferred during dev.
