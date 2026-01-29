# CRDT Audit — Candidate Entities & Strategy

Goal — ensure all replicated, collaborative, or concurrent state uses CRDT semantics to avoid manual conflict resolution.

Scope
- Applies to MCP persistence: local `pglite` (dev) and managed Postgres (prod).
- Targets entity categories that are concurrently updated or replicated.

Candidate entities and recommended CRDT types
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

Implementation notes
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

Testing
- Unit tests: CRDT op merges for each primitive (OR-Set, PNCounter, LWW register).
- Integration tests: concurrent writers with `pglite` stack asserting deterministic merged state.
- Migration tests: backfill scripts run on sample data and validate checksum diffs.

Risk & mitigation
- Existing payload types incompatible with CRDT fields — use non-destructive migrations and backfill.
- Vector index (pgvector) mapping must be preserved during schema changes — treat embedding columns as orthogonal.

Suggested tests to add
- `packages/mcp/__tests__/crdt.unit.test.ts` — unit semantics.
- `packages/mcp/__tests__/crdt.integration.test.ts` — compose-based concurrent writes.
