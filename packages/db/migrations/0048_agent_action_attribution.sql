-- Preserve historical receipts without guessing their actor/account. NULL
-- legacy attribution is excluded by authenticated readers and onboarding.
ALTER TABLE "agent_actions" ADD COLUMN IF NOT EXISTS "actor_user_id" text;
ALTER TABLE "agent_actions" ADD COLUMN IF NOT EXISTS "account_id" text;
DO $$ BEGIN
  ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "agent_actions_actor_account_idx"
  ON "agent_actions" ("actor_user_id", "account_id");
