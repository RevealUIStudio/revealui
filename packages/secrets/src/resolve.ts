import { SecretCache } from './cache.js';
import { ChainProvider } from './chain-provider.js';
import { EnvProvider } from './env-provider.js';
import { FileProvider } from './file-provider.js';
import { commandExists, RevvaultProvider } from './revvault-provider.js';
import {
  DEFAULT_SECRETS_CONFIG,
  type GetOpts,
  type SecretProvider,
  type SecretsConfig,
} from './types.js';
import { assertSecretName } from './validate.js';

export interface ResolveOpts extends GetOpts {
  config?: Partial<SecretsConfig>;
  /** Injected providers (tests). When set, auto-detect is skipped. */
  providers?: SecretProvider[];
  commandExists?: typeof commandExists;
}

const cache = new SecretCache();

function cacheTtlMs(providerId: string, config: SecretsConfig): number {
  if (providerId === 'revvault') return config.revvaultCacheTtlMs;
  if (providerId === 'file') return config.fileCacheTtlMs;
  return config.envCacheTtlMs;
}

export async function detectProviders(
  source: Record<string, string | undefined> = process.env,
  exists: typeof commandExists = commandExists,
): Promise<SecretProvider[]> {
  const providers: SecretProvider[] = [];
  if (source.KUBERNETES_SERVICE_HOST) {
    providers.push(new FileProvider());
  }
  if (await exists('revvault')) {
    providers.push(new RevvaultProvider());
  }
  providers.push(new EnvProvider());
  return providers;
}

/**
 * Auto-detect the host (Vercel / CF / K8s / revvault / env) and return the secret.
 */
export async function resolveSecret(name: string, opts: ResolveOpts = {}): Promise<string> {
  assertSecretName(name);
  const config: SecretsConfig = { ...DEFAULT_SECRETS_CONFIG, ...opts.config };
  const cacheKey = `${name}:${opts.providers?.map((p) => p.id).join(',') ?? 'auto'}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    config.onAudit?.({ name, provider: 'cache', cached: true });
    return cached;
  }

  const providers =
    opts.providers ?? (await detectProviders(opts.source ?? process.env, opts.commandExists));
  const chain = new ChainProvider(providers);
  const value = await chain.get(name, opts);
  const ttl = cacheTtlMs(providers[0]?.id ?? 'env', config);
  cache.set(cacheKey, value, ttl);
  config.onAudit?.({ name, provider: chain.id, cached: false });
  return value;
}

export function clearSecretCache(): void {
  cache.clear();
}
