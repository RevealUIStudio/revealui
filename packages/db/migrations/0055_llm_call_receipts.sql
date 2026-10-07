-- Per-call LLM receipts. No prompt text, response text, or key material.
-- Idempotent CREATE. Foreign keys use duplicate_object guards so a re-apply
-- against a database that already has the constraints is a no-op.

CREATE TABLE IF NOT EXISTS "llm_call_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text,
  "route" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "key_source" text NOT NULL,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "estimated_cost_micros" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "llm_call_receipts_key_source_check" CHECK (key_source IN ('byok', 'site', 'env'))
);

DO $$ BEGIN
  ALTER TABLE "llm_call_receipts" ADD CONSTRAINT "llm_call_receipts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "llm_call_receipts" ADD CONSTRAINT "llm_call_receipts_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "llm_call_receipts_user_id_idx" ON "llm_call_receipts" ("user_id");
CREATE INDEX IF NOT EXISTS "llm_call_receipts_account_id_idx" ON "llm_call_receipts" ("account_id");
CREATE INDEX IF NOT EXISTS "llm_call_receipts_created_at_idx" ON "llm_call_receipts" ("created_at");
