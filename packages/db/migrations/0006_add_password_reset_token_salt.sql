-- Add token_salt column to password_reset_tokens table
-- Required for HMAC-SHA256 per-token salt (added to schema after initial migration)
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "token_salt" text NOT NULL DEFAULT '';
