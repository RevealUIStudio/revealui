-- Migration 0010: app_logs table
-- Structured log storage for warn+ entries from all apps.
-- Written by the DB log transport; append-only, no FK constraints.

CREATE TABLE IF NOT EXISTS "app_logs" (
  "id"          text                     PRIMARY KEY NOT NULL,
  "timestamp"   timestamptz              NOT NULL DEFAULT now(),
  "level"       text                     NOT NULL,
  "message"     text                     NOT NULL,
  "app"         text                     NOT NULL,
  "environment" text                     NOT NULL DEFAULT 'production',
  "request_id"  text,
  "user_id"     text,
  "data"        jsonb
);

CREATE INDEX IF NOT EXISTS "app_logs_timestamp_idx"  ON "app_logs" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "app_logs_app_level_idx"  ON "app_logs" ("app", "level");
