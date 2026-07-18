-- Migration: audit_log ONE DOOR — enforce append-only + add monotonic seq +
-- tenant scope (GAP-355 Stage 2, PR-2).
--
-- WHY: PR-1 made DrizzleAuditStore the single insert(auditLog) door. PR-2 makes
-- the append-only property REAL at the DB layer and adds the two columns the
-- Stage 3/4 signing + anchoring need.
--
--   1. `seq` — a monotonic bigserial. The store never writes it (DB-assigned).
--      It fixes append order and makes a deletion detectable as a gap, which is
--      the primitive the Stage 4 anchoring checks.
--   2. `tenant` — nullable scope column for per-tenant Merkle anchoring. No
--      backfill; writers populate it going forward via append({ tenant }).
--   3. Append-only ENFORCEMENT via a BEFORE UPDATE OR DELETE trigger that RAISEs.
--
-- WHY A TRIGGER, NOT REVOKE ALONE: the app connects to Neon as the table OWNER
-- (POSTGRES_URL). A table owner BYPASSES table privileges, so `REVOKE UPDATE,
-- DELETE` does not stop the owner from mutating rows — it would be theater. A
-- BEFORE trigger fires for every role including the owner, so it is the real
-- enforcement. The REVOKE below is defense-in-depth for any future non-owner
-- role (e.g. a scoped app role). TRUNCATE is intentionally NOT blocked (a BEFORE
-- DELETE trigger does not fire on TRUNCATE) — TRUNCATE is an owner-only DDL reset,
-- not a row-level mutation, and test harnesses use it to reset the table.
--
-- IDEMPOTENCY: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
-- CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS/CREATE TRIGGER make this
-- safe to re-run (0024 precedent).
--
-- SCOPE: no data migration. Existing rows get seq values from the sequence
-- backfill and tenant = NULL.

ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "seq" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "tenant" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_seq_idx" ON "audit_log" ("seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_tenant_idx" ON "audit_log" ("tenant");--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_audit_log_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_append_only ON "audit_log";--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_append_only();--> statement-breakpoint
REVOKE UPDATE, DELETE ON "audit_log" FROM PUBLIC;
