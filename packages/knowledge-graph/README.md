# @revealui/knowledge-graph

Fleet knowledge graph core — a graphiti-style, bi-temporal, content-addressed
graph over the single Neon + pgvector primary. GAP-340.

## Overview

Stores every fleet entity (repo, package, file, symbol, dependency, db-table,
route, gap, lane, adr, agent, and more) as a node, and every relationship as a
bi-temporal edge that is **never deleted** — supersession sets `invalid_at` /
`expired_at`. Episodes are immutable provenance units; every edge traces to at
least one episode. Ids are deterministic SHA-256 UUIDs, so the same fact derived
on two sites is one row: the canonical graph is convergent by construction
(CRDT class 1/2, spec §8.1).

- **Ontology** (`./ontology`): Zod schemas for the prescribed node kinds + edge
  relations; learned entities land as `concept` / `relates-to`.
- **Deterministic ids** (`deriveNodeId` / `deriveEdgeId` / `deriveEpisodeId`).
- **Ingest** (`./ingest`): `applyScan` (deterministic-scan path with re-scan diff
  invalidation) and `ingestEpisode` (additive), over a convergent op API
  (`ON CONFLICT DO NOTHING` for G-Set rows, `LEAST`/`GREATEST` for monotonic
  columns).
- **Tier-1 extractors** (`./extractors`): workspace, ts-project (TS compiler
  API), db-schema, git, docs-frontmatter, routes, **claims** (claims-evidence →
  `documents` edges, GAP-462) — no regex over source.
- **Search** (`./search`): pgvector cosine + `websearch_to_tsquery`/`ts_rank` +
  recursive-CTE BFS, RRF-fused (k=60), reranked by node-distance and
  episode-mentions, with point-in-time predicates. `kgDrift` walks current
  `documents` edges for doc-currency candidates.
- **`revkg` CLI**: `scan`, `search`, `node`, `neighbors`, `at`, `drift`,
  `claims-check [--publish]`, `graph pull|apply|push`.
- **Fleet scan safety**: `revkg scan --fleet` is dry-run by default (no
  database, no writes). Owner publish is `revkg scan --fleet --publish` and is
  refused when `CI=true` unless `REVKG_ALLOW_WRITE=1`.
- **P5 `graph.*` replica**: pull unpushed `kg_outbox` ops, apply a remote batch
  without echoing to the peer outbox, and ack via `graph.push`. The RevDev
  daemon wraps these handlers; this package does not open a replica socket.

Embeddings are injected (`Embedder`) and best-effort — wired to `@revealui/ai`
`generateEmbedding` (nomic-embed-text, 768) by the CLI, degrading to NULL
embeddings + deferred backfill when Ollama is down. The core library imports no
LLM SDK.

## Claims honesty (GAP-462)

```bash
# Fleet scan preview (no database, no writes — safe in CI / PRs)
pnpm exec revkg scan --fleet --root . --json

# Owner-only write of sibling fleet checkouts (refused when CI=true)
pnpm exec revkg scan --fleet --root . --publish

# P5 replica: inspect unpushed outbox ops (read-only)
pnpm exec revkg graph pull --json

# Parse claims-evidence, verify path evidence exists (no DB)
pnpm exec revkg claims-check --root . --repo revealui

# Ingest claim concepts + documents edges into Neon (needs POSTGRES_URL)
pnpm exec revkg claims-check --root . --repo revealui --publish

# After a claims publish (or full scan), report doc/code staleness
pnpm exec revkg drift --repo revealui
```

## Development

### Historical memory provenance

`revkg audit-legacy-memory` emits a read-only JSON inventory for
`KG-LEGACY-MEMORY-SCOPE-MIGRATION`. It reports episode identifiers, blocker
codes and counts without printing authored payloads or scope identities.
`--publish` is rejected. This command does not restore historical reads.
The inventory also includes marked episodes whose authored snapshots are
missing or invalid; a scope marker alone is insufficient recovery evidence.

Historical memory episodes without `keyScopeVersion: 1` and their connected
nodes remain quarantined by authenticated reads. The old outbox records node
payloads without episode ownership; neighboring sequence numbers, timestamps
and current merged node metadata cannot establish that ownership. Node-only
publications may have no graph provenance at all. These are unresolved data
recovery blockers, not permission to mark old rows as scoped.

When any memory publication has incomplete provenance, authenticated reads
require every returned node field, attribute and timestamp to be attested by
authorized immutable snapshots. Unattested scan metadata and graph endpoints
remain hidden because historical node-only writes cannot identify which nodes
they mutated. All memory edges additionally require an authorized snapshot of
the actual immutable fact and attributes: a later episode sharing an edge
identity cannot authorize the earlier payload. Fresh publications can be read
when their metadata and endpoints are attested. Existing contaminated actors
or subjects can keep new incident edges hidden until authoritative recovery.
Unrestricted owner diagnostics retain access to the original records.

New additive memory ingestion stores a versioned `ingestSnapshot` of authored
node and edge rows in the immutable episode's `content_ref`. It commits in the
same transaction as graph writes and survives replica replay without a local
outbox. Caller-supplied snapshots are replaced by the ingestion engine.
Memory episode identifiers now include this snapshot; deterministic scan
identifiers are unchanged. This preserves evidence for maintained recovery
tooling; it cannot reconstruct missing historical evidence.

Reconstruction remains tracked in the delivery audit. It needs authoritative
historical snapshots or original publication records, validated scope ownership,
transactional scoped replay, idempotence, and tests for collisions and scan
contamination before any quarantined data can become visible.

```bash
pnpm --filter @revealui/knowledge-graph typecheck
pnpm --filter @revealui/knowledge-graph test
pnpm --filter @revealui/knowledge-graph build
```

Schema + migration live in `@revealui/db`
(`packages/db/src/schema/knowledge-graph.ts`,
`packages/db/migrations/0021_knowledge_graph.sql`). The migration ships
unapplied; behavior is validated against PGlite here.

## License

MIT
