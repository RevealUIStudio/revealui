-- Migration: Add password_hash to users table
-- Date: 2025-01-12
-- Description: Adds password_hash field for authentication system

-- Add password_hash column to users table
ALTER TABLE "users" ADD COLUMN "password_hash" text;

-- Add index for email lookups (if not exists)
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email") WHERE "email" IS NOT NULL;

-- Add indexes for sessions table performance
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");
