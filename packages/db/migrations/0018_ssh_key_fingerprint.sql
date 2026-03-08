-- SSH terminal auth: add SSH key fingerprint to users table
-- Supports `ssh terminal.revealui.com` payment TUI (Phase E)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ssh_key_fingerprint" text;
CREATE INDEX IF NOT EXISTS "users_ssh_key_fingerprint_idx" ON "users" ("ssh_key_fingerprint");
