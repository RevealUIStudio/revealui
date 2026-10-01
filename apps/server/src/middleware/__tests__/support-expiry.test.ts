import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  normalizePem: (raw: string) => raw.split('\\n').join('\n'),
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  getCurrentTier: vi.fn(() => 'pro'),
  getGraceConfig: vi.fn(() => ({ subscriptionDays: 3, perpetualDays: 30, infraDays: 7 })),
  getLicensePayload: vi.fn(),
  getLicenseStatus: vi.fn(() => ({ allowed: true, tier: 'pro', mode: 'active', readOnly: false })),
  isLicensed: vi.fn(() => true),
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  getRequiredTier: vi.fn(() => 'pro'),
  // Non-free tiers get real features; free is empty. Lets the read-only tests
  // assert that a lapsed license retains (or loses) features per mode.
  getFeaturesForTier: vi.fn((tier: string) =>
    tier === 'free' ? {} : { ai: true, dashboard: true, analytics: true },
  ),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getLicensePayload } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import {
  checkLicenseStatus,
  checkSupportExpiry,
  resetDbStatusCache,
  resetSupportExpiryCache,
} from '../license.js';

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
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('*', checkSupportExpiry(queryFn) as any);
  app.get('/resource', (c) => c.json({ ok: true }));
  return app;
}

afterEach(() => {
  resetSupportExpiryCache();
  resetDbStatusCache();
  delete process.env.LICENSE_READ_ONLY_ENFORCE;
  vi.mocked(logger.info).mockClear();
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

  it('reports expired support without changing purchased runtime entitlements', async () => {
    const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago (past 30-day grace)
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

    expect(res.status).toBe(200); // Still passes  -  basic admin access remains
    expect(res.headers.get('X-Support-Expires')).toBe(pastDate.toISOString());
    expect(res.headers.get('X-Support-Status')).toBe('expired');
    expect(res.headers.get('X-License-Mode')).toBeNull();
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

    // Should pass through  -  DB says not perpetual, so no enforcement
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Support-Status')).toBeNull();
  });

  it('does not downgrade when no entitlements are set (but still marks headers)', async () => {
    const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago (past 30-day grace)
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_no_ent',
      perpetual: true,
    });
    const queryFn = vi.fn().mockResolvedValue({
      supportExpiresAt: pastDate,
      perpetual: true,
    });

    // No entitlements set  -  middleware still marks headers
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

// Purchase continuity must survive legacy configuration and long support lapses.
const DAY_MS = 24 * 60 * 60 * 1000;

function createContinuityApp(queryFn: QueryFn, licenseStatus = 'support_expired') {
  const app = new Hono<{
    Variables: {
      entitlements: {
        tier: string;
        features: Record<string, boolean>;
        subscriptionStatus: string;
      };
    };
  }>();
  app.use(
    '*',
    checkLicenseStatus(async () => licenseStatus),
  );
  app.use('*', async (c, next) => {
    c.set('entitlements', { tier: 'pro', features: { ai: true }, subscriptionStatus: 'active' });
    await next();
  });
  app.use('*', checkSupportExpiry(queryFn));
  app.all('*', (c) => c.json({ entitlements: c.get('entitlements') }));
  return app;
}

function perpetualPayload() {
  mockedGetLicensePayload.mockReturnValue({
    tier: 'pro',
    customerId: 'cus_continuity',
    perpetual: true,
  });
}

describe('acquired perpetual runtime continuity', () => {
  it.each(['off', 'shadow', 'enforce'])(
    'keeps reads and writes after support lapse with legacy %s configuration',
    async (mode) => {
      process.env.LICENSE_READ_ONLY_ENFORCE = mode;
      perpetualPayload();
      const query = vi.fn().mockResolvedValue({
        supportExpiresAt: new Date(Date.now() - 3650 * DAY_MS),
        perpetual: true,
      });
      const app = createContinuityApp(query);
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        for (const path of ['/api/admin/resource', '/api/v1/content', '/a2a/tasks']) {
          const res = await app.request(path, { method });
          expect(res.status).toBe(200);
          expect(await res.json()).toEqual({
            entitlements: { tier: 'pro', features: { ai: true }, subscriptionStatus: 'active' },
          });
          expect(res.headers.get('X-Support-Status')).toBe('expired');
          expect(res.headers.get('X-License-Mode')).toBeNull();
          expect(res.headers.get('X-Support-Grace-Remaining')).toBeNull();
        }
      }
    },
  );

  it('marks support expired exactly at the coverage boundary without blocking a write', async () => {
    perpetualPayload();
    const now = new Date('2026-10-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const query = vi.fn().mockResolvedValue({ supportExpiresAt: now, perpetual: true });
      const res = await createContinuityApp(query).request('/api/content', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Support-Status')).toBe('expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps purchased features when support metadata is unavailable without claiming coverage', async () => {
    perpetualPayload();
    const res = await createContinuityApp(
      vi.fn().mockRejectedValue(new Error('database unavailable')),
    ).request('/api/content', { method: 'POST' });
    expect(res.status).toBe(200);
    expect((await res.json()).entitlements).toMatchObject({ tier: 'pro', features: { ai: true } });
    expect(res.headers.get('X-Support-Status')).toBe('unavailable');
    expect(res.headers.get('X-Support-Expires')).toBeNull();
  });

  it('still rejects a revoked purchase before support metadata is queried', async () => {
    perpetualPayload();
    const query = vi.fn();
    const res = await createContinuityApp(query, 'revoked').request('/api/content', {
      method: 'POST',
    });
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
