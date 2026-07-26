-- GAP-429 item 4: partial index for the legacy-floor derivation.
-- legacyUnsignedFloor() (apps/server/src/jobs/audit-anchor-sweep.ts) computes
-- max(seq) WHERE tenant = $1 AND signature IS NULL on the anchors request path
-- and on every no-anchor sweep pass. audit_log only indexes tenant alone, so
-- the healthy no-legacy case scans the tenant's whole row set to return 0.
-- Unsigned rows are a closed, non-growing era post-enforcement (rails from the
-- 2026-07-26 promotion), so this index stays tiny. Hand-written for the
-- IF NOT EXISTS idempotent form (see migrations-discipline.md; same class as
-- 0008's partial index).

CREATE INDEX IF NOT EXISTS "audit_log_tenant_unsigned_idx"
  ON "audit_log" ("tenant", "seq") WHERE "signature" IS NULL;
