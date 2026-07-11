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
  API), db-schema, git, docs-frontmatter, routes — no regex over source.
- **Search** (`./search`): pgvector cosine + `websearch_to_tsquery`/`ts_rank` +
  recursive-CTE BFS, RRF-fused (k=60), reranked by node-distance and
  episode-mentions, with point-in-time predicates.
- **`revkg` CLI**: `scan`, `search`, `node`, `neighbors`, `at`.

Embeddings are injected (`Embedder`) and best-effort — wired to `@revealui/ai`
`generateEmbedding` (nomic-embed-text, 768) by the CLI, degrading to NULL
embeddings + deferred backfill when Ollama is down. The core library imports no
LLM SDK.

## Development

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
