-- Migration: widen the provider CHECK constraints to allow 'anthropic' and
-- 'openai' as BYOK / site-level providers.
--
-- WHY: GAP-360 PR-1 adds Anthropic + OpenAI to LLMProviderType and the
-- createProvider factory (as OpenAI-compatible wrappers). The provider surface
-- is gated in the DB at two CHECK constraints that predate those providers:
--   - user_api_keys_provider_check                 (per-user BYOK keys)
--   - workspace_inference_configs_provider_check   (site-level infra config)
-- Both would reject an 'anthropic'/'openai' row. This widens them. The
-- workspace_inference_configs key-pairing CHECK is also widened so that the two
-- new (keyed, cloud) providers land in the non-NULL-encrypted-key branch,
-- matching groq/huggingface.
--
-- NOT WIDENED: tenant_provider_configs has no provider CHECK constraint in the
-- schema (packages/db/src/schema/api-keys.ts:68-94 declares only an index), so
-- there is nothing to widen there — 'anthropic'/'openai' are already accepted.
-- The design's "widen tenant_provider_configs" step does not apply to code
-- reality (code-over-docs). Recorded in the PR body.
--
-- SCOPE: constraint-widening only. No backfill, no data migration.
--
-- IDEMPOTENCY: DROP CONSTRAINT IF EXISTS + DO $$ ADD CONSTRAINT ... EXCEPTION
-- WHEN duplicate_object make this safe to re-run against a DB that already has
-- the widened constraints (0014/0015/0023 precedent).

ALTER TABLE "user_api_keys" DROP CONSTRAINT IF EXISTS "user_api_keys_provider_check";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_provider_check" CHECK (provider IN ('anthropic', 'openai', 'groq', 'huggingface', 'inference-snaps', 'ollama'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "workspace_inference_configs" DROP CONSTRAINT IF EXISTS "workspace_inference_configs_provider_check";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_inference_configs" ADD CONSTRAINT "workspace_inference_configs_provider_check" CHECK (provider IN ('anthropic', 'openai', 'groq', 'huggingface', 'inference-snaps', 'ollama'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "workspace_inference_configs" DROP CONSTRAINT IF EXISTS "workspace_inference_configs_key_pairing_check";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_inference_configs" ADD CONSTRAINT "workspace_inference_configs_key_pairing_check" CHECK (
  (provider IN ('inference-snaps', 'ollama') AND encrypted_api_key IS NULL)
  OR
  (provider IN ('anthropic', 'openai', 'groq', 'huggingface') AND encrypted_api_key IS NOT NULL)
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
