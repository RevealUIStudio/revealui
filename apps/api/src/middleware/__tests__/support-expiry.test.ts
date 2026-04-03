import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'pro'),
  getLicensePayload: vi.fn(),
  isLicensed: vi.fn(() => true),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'pro'),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getLicensePayload } from '@revealui/core/license';
import { checkSupportExpiry, resetSupportExpiryCache } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);

type QueryFn = (customerId: string) => Promise<{
  supportExpiresAt: Date | null;
  perpetual: boolean;
}>;

function createApp(
  queryFn: QueryFn,
  entitlements?: {
    accountId?: string | null;
    subscriptionStatus?: string | null;
    tier?: string;
    features?: Record<string, boolean>;
  },
) {
  const app = new Hono<{
    Variables: {
      entitlements?:
        | {
            accountId?: string | null;
            subscriptionStatus?: string | null;
            tier?: string;
            features?: Record<string, boolean>;
          }
        | undefined;
    };
  }>();
  app.use('*', async (c, next) => {
    if (entitlements) {
      c.set('entitlements', entitlements);
    }
    await next();
  });
  // biome-ignore lint/suspicious/noExplicitAny: test helper — middleware type is flexible
  app.use('*', checkSupportExpiry(queryFn) as any);
  app.get('/resource', (c) => c.json({ ok: true }));
  return app;
}

afterEach(() => {
  resetSupportExpiryCache();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('checkSupportExpiry', () => {
  it('passes through for non-perpetual licenses', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn();

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    // Should not query DB for non-perpetual licenses
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('passes through for free tier (no payload)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('passes through when support is active and sets X-Support-Expires header', async () => {
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_perpetual',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: futureDate,
      perpetual: true,
    });

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).toHaveBeenCalledWith('cus_perpetual');
    expect(res.headers.get('X-Support-Expires')).toBe(futureDate.toISOString());
    // Should NOT set expired status
    expect(res.headers.get('X-Support-Status')).toBeNull();
  });

  it('downgrades entitlements when support is expired', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_expired',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: pastDate,
      perpetual: true,
    });

    // Provide entitlements that should be downgraded
    const app = createApp(queryFn, {
      accountId: 'acc_1',
      tier: 'pro',
      features: { ai: true, dashboard: true },
    });
    const res = await app.request('/resource');

    expect(res.status).toBe(200); // Still passes — basic CMS access remains
    expect(res.headers.get('X-Support-Expires')).toBe(pastDate.toISOString());
    expect(res.headers.get('X-Support-Status')).toBe('expired');
  });

  it('caches support expiry and does not query every request', async () => {
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_cached',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: futureDate,
      perpetual: true,
    });

    const app = createApp(queryFn);

    // First request queries DB
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Second request uses cache
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('handles perpetual license with null supportExpiresAt (never set)', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_no_expiry',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: null,
      perpetual: true,
    });

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    // No expiry header when supportExpiresAt is null
    expect(res.headers.get('X-Support-Expires')).toBeNull();
    expect(res.headers.get('X-Support-Status')).toBeNull();
  });

  it('handles DB returning perpetual=false for JWT-perpetual license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_mismatch',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: null,
      perpetual: false,
    });

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    // Should pass through — DB says not perpetual, so no enforcement
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Support-Status')).toBeNull();
  });

  it('does not downgrade when no entitlements are set', async () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_no_ent',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: pastDate,
      perpetual: true,
    });

    // No entitlements set — middleware still marks headers
    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Support-Status')).toBe('expired');
    expect(res.headers.get('X-Support-Expires')).toBe(pastDate.toISOString());
  });

  it('resets cache via resetSupportExpiryCache', async () => {
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_reset',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: futureDate,
      perpetual: true,
    });

    const app = createApp(queryFn);

    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Reset cache
    resetSupportExpiryCache();

    // Should query again
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
