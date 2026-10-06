/**
 * Key-source label for an admin chat call.
 *
 * Mirrors the GAP-360 order (BYOK, then site, then self-hosted env) using
 * provider and model columns only. Encrypted key material is never selected.
 */

import type { Database } from '@revealui/db/client';
import {
  type LlmKeySource,
  tenantProviderConfigs,
  userApiKeys,
  workspaceInferenceConfigs,
} from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

export interface LlmCallIdentity {
  keySource: LlmKeySource;
  provider: string;
  model: string;
}

export interface KeySourceLookup {
  userProviders: readonly string[];
  /** Preferred model per provider. Empty model means unspecified. */
  userModels: readonly { provider: string; model: string | null }[];
  siteProvider: string | null;
  siteModel: string | null;
}

const UNSPECIFIED = 'unspecified';

export interface CircuitBreakerClient {
  getCircuitBreakerStats?: () => {
    primary?: { name?: string };
  };
}

/** Provider id from the live client, without reading private config or keys. */
export function providerFromCircuitBreaker(client: CircuitBreakerClient): string | null {
  const name = client.getCircuitBreakerStats?.().primary?.name;
  if (typeof name !== 'string') return null;
  const prefix = 'llm-';
  if (!name.startsWith(prefix) || name.length <= prefix.length) return null;
  return name.slice(prefix.length);
}

function label(value: string | null | undefined): string {
  if (typeof value !== 'string') return UNSPECIFIED;
  const trimmed = value.trim();
  if (trimmed.length === 0) return UNSPECIFIED;
  if (trimmed.length <= 200) return trimmed;
  return trimmed.slice(0, 200);
}

function modelForProvider(
  provider: string,
  models: readonly { provider: string; model: string | null }[],
): string {
  for (const row of models) {
    if (row.provider === provider && row.model && row.model.trim().length > 0) {
      return label(row.model);
    }
  }
  return UNSPECIFIED;
}

/**
 * Classify who paid for the call. On hosted with BYOK dispatch enabled, a
 * successful resolve is never labeled env: that label is the platform-key alarm.
 */
export function identityFromLookup(input: {
  isHosted: boolean;
  dispatchEnabled: boolean;
  clientProvider: string | null;
  envProvider: string | null;
  envModel: string | null;
  lookup: KeySourceLookup;
}): LlmCallIdentity {
  const userProvider = input.lookup.userProviders.find((provider) => provider.trim().length > 0);
  const siteProvider = input.lookup.siteProvider;

  if (!(input.dispatchEnabled && input.isHosted)) {
    if (userProvider && input.dispatchEnabled) {
      const provider = label(input.clientProvider ?? userProvider);
      return {
        keySource: 'byok',
        provider,
        model: modelForProvider(provider, input.lookup.userModels),
      };
    }
    if (siteProvider && input.dispatchEnabled) {
      const provider = label(input.clientProvider ?? siteProvider);
      return {
        keySource: 'site',
        provider,
        model: label(input.lookup.siteModel),
      };
    }
    const provider = label(input.clientProvider ?? input.envProvider);
    return {
      keySource: 'env',
      provider,
      model: label(input.envModel),
    };
  }

  if (userProvider) {
    const provider = label(input.clientProvider ?? userProvider);
    return {
      keySource: 'byok',
      provider,
      model: modelForProvider(provider, input.lookup.userModels),
    };
  }
  if (siteProvider) {
    const provider = label(input.clientProvider ?? siteProvider);
    return {
      keySource: 'site',
      provider,
      model: label(input.lookup.siteModel),
    };
  }
  return {
    keySource: 'byok',
    provider: label(input.clientProvider),
    model: UNSPECIFIED,
  };
}

export async function loadAdminChatKeyLookup(
  db: Database,
  userId: string,
  workspaceId?: string | null,
): Promise<KeySourceLookup> {
  const keys = await db
    .select({ provider: userApiKeys.provider })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId));

  const configs = await db
    .select({
      provider: tenantProviderConfigs.provider,
      model: tenantProviderConfigs.model,
    })
    .from(tenantProviderConfigs)
    .where(eq(tenantProviderConfigs.userId, userId));

  let siteProvider: string | null = null;
  let siteModel: string | null = null;
  if (workspaceId && workspaceId.trim().length > 0) {
    const [site] = await db
      .select({
        provider: workspaceInferenceConfigs.provider,
        model: workspaceInferenceConfigs.model,
      })
      .from(workspaceInferenceConfigs)
      .where(eq(workspaceInferenceConfigs.workspaceId, workspaceId))
      .limit(1);
    siteProvider = site?.provider ?? null;
    siteModel = site?.model ?? null;
  }

  return {
    userProviders: keys.map((row) => row.provider),
    userModels: configs.map((row) => ({ provider: row.provider, model: row.model })),
    siteProvider,
    siteModel,
  };
}

export async function describeAdminChatKey(input: {
  db: Database;
  userId: string;
  isHosted: boolean;
  dispatchEnabled: boolean;
  clientProvider: string | null;
  env?: NodeJS.ProcessEnv;
  workspaceId?: string | null;
}): Promise<LlmCallIdentity> {
  const env = input.env ?? process.env;
  const lookup = await loadAdminChatKeyLookup(input.db, input.userId, input.workspaceId);
  return identityFromLookup({
    isHosted: input.isHosted,
    dispatchEnabled: input.dispatchEnabled,
    clientProvider: input.clientProvider,
    envProvider: env.LLM_PROVIDER ?? null,
    envModel: env.LLM_MODEL ?? null,
    lookup,
  });
}
