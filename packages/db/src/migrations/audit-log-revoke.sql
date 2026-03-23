-- =============================================================================
-- R5-L3: Make audit_log append-only via REVOKE
-- =============================================================================
-- Defense-in-depth: the neon-rest-setup.sql already adds a trigger that raises
-- an exception on UPDATE/DELETE. This migration adds a second layer by revoking
-- UPDATE and DELETE privileges at the PostgreSQL permission level, so the
-- operation is rejected before the trigger even fires.
--
-- OWNER ACTION REQUIRED: Run this against production NeonDB.
--
-- Step 1 — Identify the role your API uses to connect:
--   SELECT current_role;   -- run from your app's connection
--
-- Step 2 — Replace <app_role> below with that role name.
--   On NeonDB the app role is typically "neondb_owner".
--
-- Step 3 — Run this script:
--   psql $DATABASE_URL -f audit-log-revoke.sql
--
-- Step 4 — Verify:
--   \dp audit_log                -- show table privileges
--   UPDATE audit_log SET id=id WHERE FALSE;  -- should fail with permission denied
-- =============================================================================

-- Revoke modification privileges on audit_log from the application role.
-- Replace <app_role> with the role used by the API (see Step 1 above).
-- Example for NeonDB: REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM neondb_owner;
REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM <app_role>;

-- If a dedicated read-write role exists separate from the owner, revoke from PUBLIC too:
-- REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM PUBLIC;

-- Confirm the table still accepts INSERTs from the app role:
-- GRANT INSERT, SELECT ON TABLE "audit_log" TO <app_role>;
