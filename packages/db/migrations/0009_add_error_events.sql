-- Migration 0009: Add error_events table
-- Persistent error tracking for CMS and API. Append-only.

CREATE TABLE IF NOT EXISTS "error_events" (
  "id"          text PRIMARY KEY,
  "timestamp"   timestamptz NOT NULL DEFAULT now(),
  "level"       text NOT NULL DEFAULT 'error',
  "message"     text NOT NULL,
  "stack"       text,
  "app"         text NOT NULL,
  "context"     text,
  "environment" text NOT NULL DEFAULT 'production',
  "url"         text,
  "user_id"     text,
  "request_id"  text,
  "metadata"    jsonb
);

CREATE INDEX IF NOT EXISTS "error_events_timestamp_idx" ON "error_events" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "error_events_app_env_idx"   ON "error_events" ("app", "environment");
CREATE INDEX IF NOT EXISTS "error_events_level_idx"     ON "error_events" ("level");
