-- =============================================================================
-- R5-L3: Make audit_log append-only via REVOKE
-- =============================================================================
-- Defense-in-depth: Drizzle migration 0002 adds a trigger that raises an
-- exception on UPDATE/DELETE. This script adds a second layer by revoking
-- UPDATE and DELETE privileges at the PostgreSQL permission level, so the
-- operation is rejected before the trigger even fires.
--
-- OWNER ACTION REQUIRED: Run this against production NeonDB.
--
--   psql $DATABASE_URL -f packages/db/src/migrations/audit-log-revoke.sql
--
-- The script auto-detects the current role — no manual substitution needed.
--
-- Verify after running:
--   \dp audit_log                                -- show table privileges
--   UPDATE audit_log SET id=id WHERE FALSE;      -- should fail with permission denied
-- =============================================================================

DO $$
DECLARE
  app_role text := current_role;
BEGIN
  -- Revoke UPDATE and DELETE from the connected role
  EXECUTE format('REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM %I', app_role);

  -- Ensure INSERT and SELECT are still granted
  EXECUTE format('GRANT INSERT, SELECT ON TABLE "audit_log" TO %I', app_role);

  RAISE NOTICE 'audit_log: REVOKE UPDATE,DELETE applied for role "%"', app_role;
END $$;
