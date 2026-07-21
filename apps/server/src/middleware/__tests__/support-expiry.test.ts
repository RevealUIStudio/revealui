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
import { checkSupportExpiry, enforceReadOnlyWrites, resetSupportExpiryCache } from '../license.js';

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

  it('downgrades entitlements when support is expired past grace period', async () => {
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
    expect(res.headers.get('X-License-Mode')).toBe('read-only');
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

// ---------------------------------------------------------------------------
// Read-only write gate (GAP-310)
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

/** A perpetual license whose support lapsed 60 days ago (past the 30-day grace). */
function lapsedPerpetual() {
  mockedGetLicensePayload.mockReturnValue({
    tier: 'pro',
    customerId: 'cus_lapsed',
    perpetual: true,
  });
  return vi
    .fn()
    .mockResolvedValue({ supportExpiresAt: new Date(Date.now() - 60 * DAY_MS), perpetual: true });
}

/** Mount entitlements → checkSupportExpiry → enforceReadOnlyWrites → echo handler. */
function createGateApp(queryFn: QueryFn) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('entitlements', { accountId: 'acc_1', tier: 'pro', features: { ai: true } });
    await next();
  });
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('*', checkSupportExpiry(queryFn) as any);
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type is flexible
  app.use('*', enforceReadOnlyWrites() as any);
  app.all('*', (c) => c.json({ ok: true, entitlements: c.get('entitlements') }));
  return app;
}

describe('enforceReadOnlyWrites (GAP-310)', () => {
  it('enforce: a lapsed perpetual retains its tier + features for reads', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'enforce';
    const app = createGateApp(lapsedPerpetual());

    const res = await app.request('/api/admin/resource'); // GET = read
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entitlements: { tier: string; features: object; readOnly?: boolean };
    };
    expect(body.entitlements.tier).toBe('pro');
    expect(Object.keys(body.entitlements.features).length).toBeGreaterThan(0);
    expect(body.entitlements.readOnly).toBe(true);
  });

  it('enforce: a write on a non-exempt route is blocked with 403 + read-only header', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'enforce';
    const app = createGateApp(lapsedPerpetual());

    const res = await app.request('/api/admin/resource', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(res.headers.get('X-License-Mode')).toBe('read-only');
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('support_expired_read_only');
  });

  it('enforce: renewal, auth, license-verify, and webhook writes stay reachable (no lockout)', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'enforce';
    const app = createGateApp(lapsedPerpetual());

    for (const path of [
      '/api/billing/checkout-support-renewal',
      '/api/auth/signin',
      '/api/license/verify',
      '/api/license/refresh',
      '/api/webhooks/stripe',
    ]) {
      const res = await app.request(path, { method: 'POST' });
      expect(res.status, `${path} must be exempt`).toBe(200);
    }
  });

  it('enforce: /a2a task dispatch (POST) is blocked while result polling (GET) is allowed', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'enforce';
    const app = createGateApp(lapsedPerpetual());

    const dispatch = await app.request('/a2a/tasks', { method: 'POST' });
    expect(dispatch.status).toBe(403);

    const poll = await app.request('/a2a/tasks/abc123'); // GET = read
    expect(poll.status).toBe(200);
  });

  it('shadow: a would-be-blocked write proceeds but is logged, and the tier stays downgraded', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'shadow';
    const app = createGateApp(lapsedPerpetual());

    const res = await app.request('/api/admin/resource', { method: 'POST' });
    expect(res.status).toBe(200); // shadow blocks nothing
    expect(vi.mocked(logger.info)).toHaveBeenCalled();
    const body = (await res.json()) as { entitlements: { tier: string } };
    expect(body.entitlements.tier).toBe('free'); // no loosening in shadow
  });

  it('off (default): identical to pre-GAP-310 — write allowed, tier downgraded, nothing logged', async () => {
    // LICENSE_READ_ONLY_ENFORCE unset → off
    const app = createGateApp(lapsedPerpetual());

    const res = await app.request('/api/admin/resource', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entitlements: { tier: string; readOnly?: boolean } };
    expect(body.entitlements.tier).toBe('free');
    expect(body.entitlements.readOnly).toBeUndefined();
    expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
  });

  it('enforce: a within-grace perpetual is unaffected — writes allowed, no read-only signal', async () => {
    process.env.LICENSE_READ_ONLY_ENFORCE = 'enforce';
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_grace',
      perpetual: true,
    });
    const queryFn = vi
      .fn()
      .mockResolvedValue({ supportExpiresAt: new Date(Date.now() - 10 * DAY_MS), perpetual: true });
    const app = createGateApp(queryFn);

    const res = await app.request('/api/admin/resource', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
