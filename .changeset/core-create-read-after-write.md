---
'@revealui/core': minor
---

Fix read-after-write failure in `create()` against pooled PostgreSQL adapters.

The `create()` operation INSERTs a document, then reads it back via `findByID()` to return the stored shape (with defaults, computed columns, and JSON deserialization applied). Previously, these two queries ran on separate pool checkouts — under the `pg` library each `db.query()` call acquires a fresh client from the pool. Depending on snapshot-acquisition timing, the read-back could execute on a connection whose snapshot predated the INSERT's commit, returning `null` and throwing _"Failed to retrieve created document with id rvl_xxx. Document not found in database."_ even though the row was present.

The root cause was a comment assuming SQLite same-connection WAL visibility applied to pooled PostgreSQL — it does not. Each pool checkout is independent under autocommit.

**Fix:**

- Added optional `transaction<T>(fn)` method to `QueryableDatabaseAdapter` and `DatabaseAdapter` types. Adapters that support it hold a single connection across the callback, wrapping the work in `BEGIN`/`COMMIT` (or `ROLLBACK` on throw).
- Implemented `transaction` in `universalPostgresAdapter` for all providers (Neon, Supabase session + transaction pooling, Electric/PGlite, generic PostgreSQL).
- `create()` now uses `db.transaction()` when available to run INSERT + `findByID()` on the same connection + snapshot. Adapters without a `transaction` method fall back to the previous sequential-query path for backward compatibility with test mocks.

Closes revealui#383.
