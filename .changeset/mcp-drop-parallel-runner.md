---
'@revealui/mcp': minor
---

Remove parallel migration pipeline and unused Postgres idempotency store (Phase 3a of the raw-SQL migration plan).

**Breaking changes:**

- `createPostgresIdempotencyStore` and the `@revealui/mcp/stores/postgres` subpath export are removed. The store had no internal consumers, a schema that diverged from the canonical `@revealui/db`'s `idempotency_keys` table, and a lazy `CREATE TABLE` that sidestepped drizzle-kit. Future MCP-owned idempotency needs should be built on the tracked Drizzle schema.

**Non-breaking cleanups:**

- `packages/mcp/migrations/0001_add_crdt_columns.sql`, `0001_rollback.sql`, and `backfill_crdt_meta.js` are deleted. They targeted `documents` / `subscription_state` tables that have never existed in the RevealUI schema, were invoked by no CI/CD or deploy path, and could not have run successfully in any environment.
- `packages/mcp/migrations/005_performance_indexes.sql` is retained — its indexes target core RevealUI tables (users, posts, sessions, media, …) and will be ported into the main Drizzle schema as proper `index()` definitions in a follow-up. Tracked in `.jv/docs/raw-sql-migration-plan.md`.

**Version bump rationale:**

Removing a publicly exported subpath + function from a pre-1.0 package. Per the SemVer + pre-1.0 policy, this is a minor bump (0.1.11 → 0.2.0).
