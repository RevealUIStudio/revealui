# MCP Migration Checklist — pglite → Managed Postgres + pgvector

Goal — safely cut over from `pglite` dev workflows to managed Postgres in production while preserving CRDT semantics and vector index integrity.

Pre‑reqs
- Staging Postgres provisioned with `pgvector` enabled.
- Backups and CI/Vault secrets available: `ELECTRIC_DATABASE_URL`, `ELECTRIC_API_KEY`, `PROD_DATABASE_URL`.
- Smoke test harness and CRDT integration tests present.

Ordered checklist
1. Backup source DB
```bash
pg_dump -Fc -f backup.before.mcp.dump "$CURRENT_DB_URL"
```
2. Provision staging DB with `pgvector`
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
3. Apply schema migrations to staging (include CRDT metadata columns)
- Add migration files: `mcp/migrations/0001_add_crdt_columns.sql` and rollback script.
4. Small backfill (sample subset)
- Run `mcp/migrations/backfill_crdt_meta.js` for representative rows; validate merges.
5. Run integration smoke tests
- Execute CRDT integration test suite against staging.
6. Export/import full snapshot (if migrating data)
```bash
pg_restore -d "$STAGING_DB_URL" backup.before.mcp.dump
```
7. Create `pgvector` indexes (maintenance window suggested)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```
8. Full backfill & compaction
- Run full backfill; compact delta-CRDT ops as needed.
9. Switch app config (canary first)
- Set `MCP_PERSISTENCE_DRIVER=postgres`
- Update `ELECTRIC_DATABASE_URL` to prod managed DB via secrets
10. Canary / canary tests
- Route small traffic, monitor conflict events and query correctness.
11. Full cutover
- Promote config change to all instances.
12. Post-migration validation
- Run full test suite, verify vector results, verify merge/conflict telemetry.
13. Rollback readiness
```bash
pg_restore -d "$PROD_DB_URL" backup.before.mcp.dump
```

Operational notes
- Prefer online migration with feature flags and small maintenance windows for index builds.
- Validate checksums and sample-row diffs after every major migration step.
- Keep rollback scripts next to each migration file.
