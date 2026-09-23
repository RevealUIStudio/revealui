-- GAP-347 — readonly Postgres role for RevealUI (Neon).
--
-- OWNER-RUN ONLY. Do not execute this file from CI, agents, or app boot.
-- Do not connect this script to Neon from automation.
--
-- Password: the committed file contains the sentinel <OWNER_SETS_PASSWORD>.
-- The first run refuses to create the role until you replace that sentinel
-- with a password you generated. Do not commit the password, paste it into
-- chat, or store it anywhere except revvault (see the runbook).
--
-- Re-running the committed file after the role exists refreshes GRANTs and
-- does not change the password.
--
-- Apply with the table-owner role (the role behind revealui/<tier>/db/postgres-url)
-- on Neon's direct (non-pooler) host, while connected to the target database.
-- First run: copy this file to a private scratch path, replace the sentinel, then:
--   psql "$DIRECT_OWNER_URL" -v ON_ERROR_STOP=1 -f /path/to/private-scratch.sql
--
-- Vault (do not put the URL in this file):
--   prod:    revealui/prod/db/postgres-url-readonly
--   staging: revealui/staging/db/postgres-url-readonly
-- Leaf name: postgres-url-readonly
--
-- Runbook: docs/runbooks/postgres-readonly-role.md

-- Create the login only when it is missing. A still-present sentinel aborts
-- creation so this file cannot install a known password.
DO $$
DECLARE
  -- Replace ONLY the quoted value on the next line before the first run.
  chosen_password text := '<OWNER_SETS_PASSWORD>';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revealui_readonly') THEN
    RAISE NOTICE 'role revealui_readonly already exists; password left unchanged';
    RETURN;
  END IF;

  IF chosen_password = '<OWNER_SETS_PASSWORD>' THEN
    RAISE EXCEPTION
      'Replace <OWNER_SETS_PASSWORD> before the first run. Generate the password yourself. Do not commit it.';
  END IF;

  EXECUTE format(
    'CREATE ROLE revealui_readonly WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT',
    chosen_password
  );
END
$$;

-- Attribute refresh never includes PASSWORD, so a re-run cannot clobber it.
ALTER ROLE revealui_readonly
  WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT LOGIN;

-- Connect only to the database you are currently attached to.
DO $$
DECLARE
  dbname text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO revealui_readonly', dbname);
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM revealui_readonly', dbname);
  RAISE NOTICE 'CONNECT granted on database %', dbname;
END
$$;

-- public: application tables (Drizzle). Explicit SELECT restates least privilege
-- even if pg_read_all_data is later revoked.
REVOKE ALL ON SCHEMA public FROM revealui_readonly;
GRANT USAGE ON SCHEMA public TO revealui_readonly;
REVOKE CREATE ON SCHEMA public FROM revealui_readonly;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM revealui_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO revealui_readonly;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM revealui_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO revealui_readonly;

-- Defaults apply to objects later created by the role running this script
-- (current_user). Migrations must run as that same role for new tables to
-- inherit SELECT. pg_read_all_data covers a mismatch; keep both.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO revealui_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO revealui_readonly;

DO $$
BEGIN
  RAISE NOTICE 'default privileges for future public objects attach to role %', current_user;
END
$$;

-- drizzle: migration journal schema. Present after the first drizzle-kit migrate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle') THEN
    RAISE NOTICE 'schema drizzle is absent; skipped';
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON SCHEMA drizzle FROM revealui_readonly';
  EXECUTE 'GRANT USAGE ON SCHEMA drizzle TO revealui_readonly';
  EXECUTE 'REVOKE CREATE ON SCHEMA drizzle FROM revealui_readonly';
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM revealui_readonly';
  EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO revealui_readonly';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA drizzle GRANT SELECT ON TABLES TO revealui_readonly';
END
$$;

-- Predefined read-all covers tables created later by any role, in any schema.
-- SELECT on relations only: no INSERT/UPDATE/DELETE, no sequence nextval, no BYPASSRLS.
-- Explicit grants above still stand if this membership is unavailable.
DO $$
BEGIN
  GRANT pg_read_all_data TO revealui_readonly;
EXCEPTION
  WHEN insufficient_privilege OR undefined_object THEN
    RAISE NOTICE
      'pg_read_all_data was not granted (%). Explicit SELECT grants still apply; re-run this section after migrations if new tables must be covered without that membership.',
      SQLERRM;
END
$$;

-- Read-only posture check. rolsuper / rolcreatedb / rolcreaterole /
-- rolreplication / rolbypassrls must all be false; rolcanlogin must be true.
SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  rolbypassrls
FROM pg_roles
WHERE rolname = 'revealui_readonly';
