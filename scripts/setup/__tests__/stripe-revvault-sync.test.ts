import { describe, expect, it, vi } from 'vitest';
import { resolveManifestPath } from '../../sync/resolve-manifest-dir.js';
import {
  loadManifestEnvKeyToVaultPath,
  parseManifestEnvKeyToVaultPath,
  syncToRevvault,
} from '../stripe-revvault-sync.js';

const MANIFEST_PATH = resolveManifestPath('vercel');

const noop = (): void => undefined;
const silentLog = { info: noop, success: noop, warn: noop, error: noop };

describe('parseManifestEnvKeyToVaultPath', () => {
  it('maps KEY = "revealui/..." lines; ignores comments, sections, arrays, non-vault values', () => {
    const text = [
      '# a comment',
      '[projects.revealui-api]',
      'project_id = "prj_123"', // value is not a revealui/ path -> ignored
      '',
      '[projects.revealui-api.vars]',
      'STRIPE_PRO_PRICE_ID                  = "revealui/prod/stripe/pro-price-id"', // aligned
      'STRIPE_MAX_PRICE_ID = "revealui/prod/stripe/max-price-id"', // tight
      'skip = ["STRIPE_LIVE_MODE"]', // array value -> ignored
    ].join('\n');

    const map = parseManifestEnvKeyToVaultPath(text);

    expect(map.get('STRIPE_PRO_PRICE_ID')).toBe('revealui/prod/stripe/pro-price-id');
    expect(map.get('STRIPE_MAX_PRICE_ID')).toBe('revealui/prod/stripe/max-price-id');
    expect(map.has('project_id')).toBe(false);
    expect(map.has('skip')).toBe(false);
  });
});

describe.skipIf(!MANIFEST_PATH)(
  'drift guard: seeded price env keys must have a manifest vault path',
  () => {
  it('maps every STRIPE_*_PRICE_ID the seeder emits to a revealui/prod/stripe/ path', () => {
    const map = loadManifestEnvKeyToVaultPath(MANIFEST_PATH as string);
    // Mirrors PRICE_SERVER_ENV_KEYS in seed-stripe.ts (the vaulted price keys).
    // Adding a new price env key without a manifest entry fails this test ->
    // add the revvault-vercel.toml mapping before merging.
    const requiredKeys = [
      'STRIPE_PRO_PRICE_ID',
      'STRIPE_MAX_PRICE_ID',
      'STRIPE_MAX_ANNUAL_PRICE_ID',
      'STRIPE_ENTERPRISE_PRICE_ID',
      'STRIPE_PERPETUAL_PRO_PRICE_ID',
      'STRIPE_PERPETUAL_MAX_PRICE_ID',
      'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
      'STRIPE_CREDITS_STARTER_PRICE_ID',
      'STRIPE_CREDITS_STANDARD_PRICE_ID',
      'STRIPE_CREDITS_SCALE_PRICE_ID',
    ];
    for (const key of requiredKeys) {
      const vaultPath = map.get(key);
      expect(vaultPath, `${key} is missing from the private vercel sync manifest`).toBeDefined();
      expect(vaultPath?.startsWith('revealui/prod/stripe/')).toBe(true);
    }
  });
},
);

describe('syncToRevvault', () => {
  it('writes mapped keys, skips unmapped keys, reports results', () => {
    const calls: Array<{ path: string; value: string }> = [];
    const result = syncToRevvault(
      {
        STRIPE_PRO_PRICE_ID: 'price_pro',
        STRIPE_RENEWAL_PRO_PRICE_ID: 'price_renewal_pro',
        STRIPE_NO_MANIFEST_KEY: 'no_vault_path', // intentionally unmapped
      },
      {
        manifestPath: MANIFEST_PATH,
        setter: (path, value) => calls.push({ path, value }),
        log: silentLog,
      },
    );

    expect(calls).toEqual([
      { path: 'revealui/prod/stripe/pro-price-id', value: 'price_pro' },
      { path: 'revealui/prod/stripe/renewal-pro-price-id', value: 'price_renewal_pro' },
    ]);
    expect(result.written).toEqual([
      'revealui/prod/stripe/pro-price-id',
      'revealui/prod/stripe/renewal-pro-price-id',
    ]);
    expect(result.skipped).toEqual(['STRIPE_NO_MANIFEST_KEY']);
    expect(result.failed).toEqual([]);
  });

  it('does not call the setter in dry-run', () => {
    const setter = vi.fn();
    const result = syncToRevvault(
      { STRIPE_PRO_PRICE_ID: 'price_pro' },
      { manifestPath: MANIFEST_PATH, dryRun: true, setter, log: silentLog },
    );

    expect(setter).not.toHaveBeenCalled();
    expect(result.written).toEqual(['revealui/prod/stripe/pro-price-id']);
  });

  it('collects per-key failures without throwing', () => {
    const result = syncToRevvault(
      { STRIPE_PRO_PRICE_ID: 'price_pro' },
      {
        manifestPath: MANIFEST_PATH,
        setter: () => {
          throw new Error('revvault unavailable');
        },
        log: silentLog,
      },
    );

    expect(result.written).toEqual([]);
    expect(result.failed).toEqual(['revealui/prod/stripe/pro-price-id']);
  });
});
