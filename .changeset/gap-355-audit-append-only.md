---
'@revealui/db': minor
---

audit_log append-only enforcement + monotonic seq + tenant scope (GAP-355 Stage 2 PR-2). Migration 0026 adds a `BEFORE UPDATE OR DELETE` trigger that enforces append-only at the DB layer (a plain REVOKE is toothless against the owner role the app connects as, so the trigger is the real enforcement; REVOKE UPDATE/DELETE FROM PUBLIC is defense-in-depth). Adds a `seq` monotonic bigserial (DB-assigned; deletion-gap detectable) and a nullable `tenant` column for per-tenant anchoring. `DrizzleAuditStore.append` accepts an optional `tenant` pass-through; `seq` is never written by the store.
