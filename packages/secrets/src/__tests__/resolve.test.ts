import { afterEach, describe, expect, it } from 'vitest';

import { EnvProvider } from '../env-provider.js';
import { clearSecretCache, detectProviders, resolveSecret } from '../resolve.js';
import { SecretNotFoundError } from '../types.js';

afterEach(() => {
  clearSecretCache();
});

describe('detectProviders', () => {
  it('uses FileProvider when KUBERNETES_SERVICE_HOST is set', async () => {
    const providers = await detectProviders({ KUBERNETES_SERVICE_HOST: '1' }, async () => false);
    expect(providers.map((p) => p.id)).toEqual(['file', 'env']);
  });

  it('uses RevvaultProvider when revvault exists', async () => {
    const providers = await detectProviders({}, async (bin) => bin === 'revvault');
    expect(providers.map((p) => p.id)).toEqual(['revvault', 'env']);
  });

  it('defaults to EnvProvider', async () => {
    const providers = await detectProviders({ VERCEL: '1' }, async () => false);
    expect(providers.map((p) => p.id)).toEqual(['env']);
  });
});

describe('resolveSecret', () => {
  it('reads from injected providers', async () => {
    const value = await resolveSecret('REVEALUI_LICENSE_KEY', {
      providers: [new EnvProvider()],
      source: { REVEALUI_LICENSE_KEY: 'jwt' },
    });
    expect(value).toBe('jwt');
  });

  it('throws SecretNotFoundError when every provider misses', async () => {
    await expect(
      resolveSecret('NOPE', { providers: [new EnvProvider()], source: {} }),
    ).rejects.toBeInstanceOf(SecretNotFoundError);
  });

  it('fires the audit hook', async () => {
    const events: string[] = [];
    await resolveSecret('K', {
      providers: [new EnvProvider()],
      source: { K: 'v' },
      config: { onAudit: (e) => events.push(e.provider), envCacheTtlMs: 0 },
    });
    expect(events).toEqual(['chain']);
  });
});
