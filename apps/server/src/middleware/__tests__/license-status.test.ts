import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'pro'),
  getGraceConfig: vi.fn(() => ({ subscriptionDays: 3, perpetualDays: 30, infraDays: 7 })),
  getLicensePayload: vi.fn(),
  getLicenseStatus: vi.fn(() => ({ allowed: true, tier: 'pro', mode: 'active', readOnly: false })),
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
import { errorHandler } from '../error.js';
import { checkLicenseStatus, resetDbStatusCache } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function createApp(
  queryFn: (customerId: string) => Promise<string | null>,
  entitlements?: { accountId?: string | null; subscriptionStatus?: string | null },
) {
  const app = new Hono<{
    Variables: {
      entitlements?:
        | {
            accountId?: string | null;
            subscriptionStatus?: string | null;
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
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('*', checkLicenseStatus(queryFn) as any);
  app.get('/resource', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

afterEach(() => {
  resetDbStatusCache();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('checkLicenseStatus', () => {
  it('passes for active license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('active');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).toHaveBeenCalledWith('cus_1');
  });

  it('returns 403 for revoked license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('revoked');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('revoked');
  });

  it('returns 403 for expired license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('expired');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('expired');
  });

  it('skips DB check for free tier (no payload)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('caches DB result and does not query every request', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue('active');

    const app = createApp(queryFn);

    // First request should query
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Second request should use cache
    await app.request('/resource');
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('defaults to active when query returns null', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const queryFn = vi.fn().mockResolvedValue(null);

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
  });

  it('caches status separately per customerId', async () => {
    const queryFn = vi
      .fn()
      .mockImplementation(async (customerId: string) =>
        customerId === 'cus_1' ? 'active' : 'revoked',
      );

    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
    });
    const app = createApp(queryFn);

    const res1 = await app.request('/resource');
    expect(res1.status).toBe(200);

    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_2',
    });

    const res2 = await app.request('/resource');
    expect(res2.status).toBe(403);
    expect(queryFn).toHaveBeenNthCalledWith(1, 'cus_1');
    expect(queryFn).toHaveBeenNthCalledWith(2, 'cus_2');
  });

  it('skips the legacy DB query for hosted account entitlements', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn, {
      accountId: 'acct_123',
      subscriptionStatus: 'active',
    });
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('returns 403 for revoked hosted account entitlements', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn, {
      accountId: 'acct_123',
      subscriptionStatus: 'revoked',
    });
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('revoked');
    expect(queryFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GAP-139: dbStatusCache TTL freshness — post-revocation Pro access window
// ---------------------------------------------------------------------------
describe('checkLicenseStatus  -  cache TTL freshness (GAP-139)', () => {
  it('re-queries DB after the cache TTL window expires (revocation propagation)', async () => {
    vi.useFakeTimers();
    try {
      mockedGetLicensePayload.mockReturnValue({
        tier: 'pro',
        customerId: 'cus_ttl_1',
      });

      // First call returns 'active'; subsequent calls return 'revoked' to
      // simulate Stripe-side revocation that arrived between cache-fill +
      // next read.
      const queryFn = vi
        .fn<(customerId: string) => Promise<string>>()
        .mockResolvedValueOnce('active')
        .mockResolvedValue('revoked');

      const app = createApp(queryFn);

      // First request: queries DB, caches 'active' result, returns 200
      const res1 = await app.request('/resource');
      expect(res1.status).toBe(200);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // Within TTL: cached 'active' is reused, DB NOT queried
      vi.advanceTimersByTime(20_000); // +20s, still within default 30s TTL
      const res2 = await app.request('/resource');
      expect(res2.status).toBe(200);
      expect(queryFn).toHaveBeenCalledTimes(1);

      // After TTL: DB MUST be re-queried; revocation propagates
      // 35s total = 35s after the first cache write, beyond the 30s default
      vi.advanceTimersByTime(15_000);
      const res3 = await app.request('/resource');
      expect(res3.status).toBe(403);
      expect(queryFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-queries DB on EVERY request when the cache is invalidated by resetDbStatusCache()', async () => {
    // Sanity check that the existing reset path still works (used by
    // webhook handlers post-revocation to invalidate cached state).
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_reset_1',
    });

    const queryFn = vi
      .fn<(customerId: string) => Promise<string>>()
      .mockResolvedValueOnce('active')
      .mockResolvedValue('revoked');

    const app = createApp(queryFn);

    // First request: caches 'active'
    const res1 = await app.request('/resource');
    expect(res1.status).toBe(200);

    // Manual cache invalidation (what webhook handlers do post-revocation)
    resetDbStatusCache();

    // Next request: must hit DB again, sees 'revoked'
    const res2 = await app.request('/resource');
    expect(res2.status).toBe(403);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
