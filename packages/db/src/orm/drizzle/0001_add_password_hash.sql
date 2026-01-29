
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email") WHERE "email" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");
