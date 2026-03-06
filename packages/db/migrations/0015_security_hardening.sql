-- Security hardening: ai_memory_sessions table + email token expiry
--
-- Fix 3: Add ai_memory_sessions to bind CRDT sessionIds to userId.
--        Working-memory and context routes check this table for ownership.
--
-- Fix 9: Add email_verification_token_expires_at to users.
--        SHA-256 hashed tokens now have a 24h expiry window.
--        Also backfills email_verification_token if not already present
--        (the column was in schema source but lacked a prior migration).

-- email_verification_token was added to schema without a migration; add
-- the column if it does not already exist to bring the DB in sync.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" text;

-- New: expiry timestamp for the hashed verification token (24h TTL).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_expires_at" timestamp with time zone;

-- New: session-ownership table for AI working/context memory routes.
CREATE TABLE IF NOT EXISTS "ai_memory_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_memory_sessions_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action
);
