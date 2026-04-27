/**
 * Boot-time hydration of the in-memory `WorkspaceProviderRegistry` from
 * the `workspace_inference_configs` table.
 *
 * Loaded once at apps/api startup (see index.ts startup branches). After
 * this completes, agent runtime that calls
 * `workspaceProviderRegistry.createClientForWorkspace(siteId, fallback)`
 * will use the per-site config; the admin PUT route updates the registry
 * inline so subsequent runs of this function on next boot are correct.
 *
 * Best-effort: if `@revealui/ai` is not installed (OSS-only deployments),
 * skip silently. If the DB query fails, log and continue — agents fall back
 * to env-based provider config.
 */

import { getClient } from '@revealui/db';
import { decryptApiKey } from '@revealui/db/crypto';
import { workspaceInferenceConfigs } from '@revealui/db/schema';
import { logger } from '@revealui/core/observability/logger';

const KEYLESS_PROVIDERS = new Set(['inference-snaps', 'ollama']);

export async function hydrateInferenceConfigs(): Promise<void> {
  const aiMod = await import('@revealui/ai/llm/server').catch(() => null);
  if (!aiMod || !aiMod.workspaceProviderRegistry) {
    // @revealui/ai not installed (OSS-only); nothing to hydrate.
    return;
  }

  try {
    const db = getClient();
    const rows = await db.select().from(workspaceInferenceConfigs);

    for (const row of rows) {
      // Keyless providers store NULL encryptedApiKey; we pass the provider
      // name as the placeholder API key — matches createLLMClientFromEnv.
      const apiKey =
        row.encryptedApiKey === null ? row.provider : decryptApiKey(row.encryptedApiKey);

      aiMod.workspaceProviderRegistry.set({
        workspaceId: row.workspaceId,
        provider: row.provider as Parameters<
          typeof aiMod.workspaceProviderRegistry.set
        >[0]['provider'],
        apiKey,
        model: row.model ?? undefined,
        baseURL: row.baseURL ?? undefined,
        temperature: row.temperature ?? undefined,
        maxTokens: row.maxTokens ?? undefined,
      });
    }

    logger.info(`Hydrated ${rows.length} workspace inference config(s)`, {
      keylessCount: rows.filter((r) => KEYLESS_PROVIDERS.has(r.provider)).length,
    });
  } catch (err) {
    logger.warn('Failed to hydrate workspace inference configs from DB', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
