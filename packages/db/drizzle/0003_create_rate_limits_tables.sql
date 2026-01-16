-- Migration: Create rate_limits and failed_attempts tables
-- Created: 2025-01-27
-- Purpose: Support distributed rate limiting and brute force protection

-- Rate Limits Table
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "reset_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries (expired entries)
CREATE INDEX IF NOT EXISTS "idx_rate_limits_reset_at" ON "rate_limits" ("reset_at");

-- Failed Attempts Table
CREATE TABLE IF NOT EXISTS "failed_attempts" (
  "email" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0,
  "lock_until" TIMESTAMP WITH TIME ZONE,
  "window_start" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries (expired locks)
CREATE INDEX IF NOT EXISTS "idx_failed_attempts_lock_until" ON "failed_attempts" ("lock_until");
CREATE INDEX IF NOT EXISTS "idx_failed_attempts_window_start" ON "failed_attempts" ("window_start");
