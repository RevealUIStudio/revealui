-- Migration: Add email uniqueness constraint
-- Date: 2025-01-12
-- Description: Adds unique constraint on users.email to prevent duplicate emails

-- Drop existing index if it exists (non-unique)
DROP INDEX IF EXISTS "users_email_idx";

-- Create unique index on email (only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users"("email") WHERE "email" IS NOT NULL;
