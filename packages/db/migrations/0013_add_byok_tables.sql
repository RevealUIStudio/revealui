-- Migration: 0013_add_byok_tables
-- Adds encrypted API key storage and provider configuration for BYOK (Bring Your Own Key).
-- Server-side AES-256-GCM envelope encryption enables background agent workflows
-- without requiring the user to be present in the browser session.

CREATE TABLE IF NOT EXISTS "user_api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "encrypted_key" text NOT NULL,
  "key_hint" text,
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "user_api_keys_user_id_idx" ON "user_api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "user_api_keys_user_provider_idx" ON "user_api_keys" ("user_id", "provider");

CREATE TABLE IF NOT EXISTS "tenant_provider_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "model" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tenant_provider_configs_user_id_idx" ON "tenant_provider_configs" ("user_id");
