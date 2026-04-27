/**
 * Per-Site Inference Configuration — Max-tier `aiInference` paywall.
 *
 * Site-level governance over which LLM provider all agents acting on the
 * site use. Distinct from per-user BYOK in `tenant_provider_configs`:
 *
 *   - `tenant_provider_configs` (per-user): "Bob's preferred provider for
 *     Bob's agents." Solo-founder shape.
 *   - `workspace_inference_configs` (per-site): "Site X is locked to
 *     Groq for governance/cost." Multi-agent shape.
 *
 * Inference Snaps (Canonical) and Ollama are keyless — `encryptedApiKey`
 * is NULL for those rows, paired by a CHECK constraint with `provider`.
 *
 * Loaded into `WorkspaceProviderRegistry` at apps/api boot.
 */

import { sql } from 'drizzle-orm';
import { check, integer, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sites } from './sites.js';

export const workspaceInferenceConfigs = pgTable(
  'workspace_inference_configs',
  {
    id: text('id').primaryKey(),

    workspaceId: text('workspace_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),

    provider: text('provider').notNull(),

    // AES-256-GCM envelope-encrypted API key (NULL for keyless providers).
    // Format: <base64url(iv)>.<base64url(authTag)>.<base64url(ciphertext)>
    // — see `@revealui/db/crypto` `encryptApiKey`/`decryptApiKey`.
    encryptedApiKey: text('encrypted_api_key'),

    // Last 4 chars of plaintext key for UI display (e.g. "...ab12").
    // NULL when provider is keyless.
    keyHint: text('key_hint'),

    // Optional overrides — provider defaults apply when NULL.
    model: text('model'),
    baseURL: text('base_url'),
    temperature: real('temperature'),
    maxTokens: integer('max_tokens'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One config per site
    uniqueIndex('workspace_inference_configs_workspace_id_uidx').on(table.workspaceId),

    // Provider must be one of the 4 LLMProviderType values. Vultr was
    // removed in this same PR (bespoke provider with no differentiation
    // vs. Groq/HF). Inference Snaps + Ollama are local; Groq + HF are
    // cloud BYOK.
    check(
      'workspace_inference_configs_provider_check',
      sql`provider IN ('groq', 'huggingface', 'inference-snaps', 'ollama')`,
    ),

    // Pairing: keyless providers MUST have NULL encrypted_api_key;
    // keyed providers MUST have a non-NULL encrypted_api_key.
    check(
      'workspace_inference_configs_key_pairing_check',
      sql`(
        (provider IN ('inference-snaps', 'ollama') AND encrypted_api_key IS NULL)
        OR
        (provider IN ('groq', 'huggingface') AND encrypted_api_key IS NOT NULL)
      )`,
    ),
  ],
);

export type WorkspaceInferenceConfig = typeof workspaceInferenceConfigs.$inferSelect;
export type NewWorkspaceInferenceConfig = typeof workspaceInferenceConfigs.$inferInsert;
