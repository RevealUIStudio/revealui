-- Fix audit_log.severity values before migration 0001
-- Maps risk-level values (low/medium/high) to log-level values (info/warn/critical)
-- Run: POSTGRES_URL="..." psql "$POSTGRES_URL" -f scripts/db/fix-audit-log-severity.sql

BEGIN;

UPDATE audit_log SET severity = 'info'     WHERE severity = 'low';
UPDATE audit_log SET severity = 'warn'     WHERE severity = 'medium';
UPDATE audit_log SET severity = 'critical' WHERE severity = 'high';

-- Verify no orphaned values remain
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM audit_log
    WHERE severity NOT IN ('info', 'warn', 'critical')
  ) THEN
    RAISE EXCEPTION 'Unexpected severity values still exist — aborting';
  END IF;
END $$;

COMMIT;
