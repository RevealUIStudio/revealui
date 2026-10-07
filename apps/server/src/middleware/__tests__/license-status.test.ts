import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: vi.fn(() => 'live'),
}));

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
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getLicensePayload, type LicensePayload } from '@revealui/core/license';
import { errorHandler } from '../error.js';
import { checkLicenseStatus, resetDbStatusCache } from '../license.js';

const mockedGetLicensePayload = vi.mocked(getLicensePayload);

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function createApp(
  queryFn: (payload: LicensePayload) => Promise<string | null>,
  entitlements?: {
    accountId?: string | null;
    subscriptionStatus?: string | null;
    graceUntil?: Date | null;
  },
) {
  const app = new Hono<{
    Variables: {
      entitlements?:
        | {
            accountId?: string | null;
            subscriptionStatus?: string | null;
            graceUntil?: Date | null;
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
  vi.useRealTimers();
  vi.mocked(getConfiguredStripeMode).mockReturnValue('live');
});

describe('license authority outages', () => {
  const dayMs = 86_400_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_outage',
      jti: 'key_1',
    });
  });

  it('refuses an unvalidated status during an outage, including after restart', async () => {
    const query = vi.fn().mockResolvedValueOnce('active').mockRejectedValue(new Error('offline'));
    const app = createApp(query);
    expect((await app.request('/resource')).status).toBe(200);
    resetDbStatusCache();

    expect((await app.request('/resource')).status).toBe(503);
  });

  it('never borrows another token’s outage evidence for the same customer', async () => {
    const query = vi.fn().mockResolvedValueOnce('active').mockRejectedValue(new Error('offline'));
    const app = createApp(query);
    expect((await app.request('/resource')).status).toBe(200);
    mockedGetLicensePayload.mockReturnValue({
      customerId: 'cus_outage',
      tier: 'pro',
      jti: 'key_unvalidated',
    });
    expect((await app.request('/resource')).status).toBe(503);
  });

  it.each([null, 'unknown'])(
    'keeps an authoritative unusable status %s denied during a later outage',
    async (status) => {
      const query = vi.fn().mockResolvedValueOnce(status).mockRejectedValue(new Error('offline'));
      const app = createApp(query);
      expect((await app.request('/resource')).status).toBe(403);
      vi.advanceTimersByTime(8 * dayMs);
      expect((await app.request('/resource')).status).toBe(403);
    },
  );

  it('retains a validated license for seven days, then prevents the handler from executing', async () => {
    const query = vi.fn().mockResolvedValueOnce('active').mockRejectedValue(new Error('offline'));
    const app = createApp(query);
    expect((await app.request('/resource')).status).toBe(200);
    vi.advanceTimersByTime(31_000);
    const firstFailure = await app.request('/resource');
    expect(firstFailure.status).toBe(200);
    expect(firstFailure.headers.get('X-License-Mode')).toBe('grace');
    vi.advanceTimersByTime(7 * dayMs - 1);
    expect((await app.request('/resource')).status).toBe(200);
    vi.advanceTimersByTime(1);
    const exhausted = await app.request('/resource');
    expect(exhausted.status).toBe(503);
    expect(await exhausted.json()).not.toEqual({ ok: true });
    expect((await app.request('/resource')).status).toBe(503);
  });

  it('does not let another customer reset an existing outage window', async () => {
    const query = vi.fn().mockResolvedValue('active');
    const app = createApp(query);
    await app.request('/resource');
    vi.advanceTimersByTime(31_000);
    query.mockRejectedValueOnce(new Error('offline'));
    await app.request('/resource');
    vi.advanceTimersByTime(6 * dayMs);
    mockedGetLicensePayload.mockReturnValue({ tier: 'pro', customerId: 'cus_other', jti: 'key_2' });
    expect((await app.request('/resource')).status).toBe(200);
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_outage',
      jti: 'key_1',
    });
    query.mockRejectedValue(new Error('offline'));
    vi.advanceTimersByTime(dayMs);
    expect((await app.request('/resource')).status).toBe(503);
  });

  it.each(['revoked', 'expired'])(
    'never grants outage grace to a known %s license',
    async (status) => {
      const query = vi.fn().mockResolvedValueOnce(status).mockRejectedValue(new Error('offline'));
      const app = createApp(query);
      expect((await app.request('/resource')).status).toBe(403);
      vi.advanceTimersByTime(8 * dayMs);
      expect((await app.request('/resource')).status).toBe(403);
    },
  );

  it('rechecks revocation after the authority recovers from an exhausted outage', async () => {
    const query = vi.fn().mockResolvedValueOnce('active').mockRejectedValue(new Error('offline'));
    const app = createApp(query);
    await app.request('/resource');
    vi.advanceTimersByTime(31_000);
    await app.request('/resource');
    vi.advanceTimersByTime(7 * dayMs);
    expect((await app.request('/resource')).status).toBe(503);
    query.mockResolvedValue('revoked');
    expect((await app.request('/resource')).status).toBe(403);
  });

  it('starts a new outage window only after the same customer validates successfully', async () => {
    const query = vi.fn().mockResolvedValue('active');
    const app = createApp(query);
    await app.request('/resource');
    vi.advanceTimersByTime(31_000);
    query.mockRejectedValueOnce(new Error('offline'));
    await app.request('/resource');
    vi.advanceTimersByTime(6 * dayMs);
    expect((await app.request('/resource')).status).toBe(200);
    vi.advanceTimersByTime(31_000);
    query.mockRejectedValue(new Error('offline'));
    expect((await app.request('/resource')).status).toBe(200);
    vi.advanceTimersByTime(2 * dayMs);
    expect((await app.request('/resource')).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('checkLicenseStatus', () => {
  it.each([{ jti: 'another_jti' }, { tier: 'max' as const }, { perpetual: true }])(
    'does not share cached authority across signed identities: %o',
    async (change) => {
      const first: LicensePayload = { customerId: 'cus_bound', tier: 'pro', jti: 'jti_first' };
      const query = vi.fn().mockResolvedValueOnce('active').mockResolvedValue('revoked');
      const app = createApp(query);
      mockedGetLicensePayload.mockReturnValue(first);
      expect((await app.request('/resource')).status).toBe(200);
      mockedGetLicensePayload.mockReturnValue({ ...first, ...change });
      expect((await app.request('/resource')).status).toBe(403);
      expect(query).toHaveBeenCalledTimes(2);
    },
  );

  it('does not share authority evidence across Stripe billing modes', async () => {
    mockedGetLicensePayload.mockReturnValue({
      customerId: 'cus_bound',
      tier: 'pro',
      jti: 'jti_mode',
    });
    const query = vi.fn().mockResolvedValueOnce('active').mockResolvedValue('revoked');
    const app = createApp(query);
    expect((await app.request('/resource')).status).toBe(200);
    vi.mocked(getConfiguredStripeMode).mockReturnValue('test');
    expect((await app.request('/resource')).status).toBe(403);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('passes for active license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
      jti: 'jti_1',
    });
    const queryFn = vi.fn().mockResolvedValue('active');

    const app = createApp(queryFn);
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_1', jti: 'jti_1' }),
    );
  });

  it('returns 403 for revoked license', async () => {
    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
      jti: 'jti_1',
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
      jti: 'jti_1',
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
      jti: 'jti_1',
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

  it.each([null, 'unknown', 'past_due', 'canceled', 'support_expired'])(
    'denies a subscription grant with unusable registration status %s',
    async (status) => {
      mockedGetLicensePayload.mockReturnValue({
        tier: 'pro',
        customerId: 'cus_1',
        jti: 'jti_1',
      });
      const queryFn = vi.fn().mockResolvedValue(status);

      const app = createApp(queryFn);
      const res = await app.request('/resource');

      expect(res.status).toBe(403);
    },
  );

  it('caches status separately per customerId', async () => {
    const queryFn = vi
      .fn()
      .mockImplementation(async (payload: LicensePayload) =>
        payload.customerId === 'cus_1' ? 'active' : 'revoked',
      );

    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_1',
      jti: 'jti_1',
    });
    const app = createApp(queryFn);

    const res1 = await app.request('/resource');
    expect(res1.status).toBe(200);

    mockedGetLicensePayload.mockReturnValue({
      tier: 'pro',
      customerId: 'cus_2',
      jti: 'jti_1',
    });

    const res2 = await app.request('/resource');
    expect(res2.status).toBe(403);
    expect(queryFn).toHaveBeenNthCalledWith(1, expect.objectContaining({ customerId: 'cus_1' }));
    expect(queryFn).toHaveBeenNthCalledWith(2, expect.objectContaining({ customerId: 'cus_2' }));
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

  it('returns 403 for a past_due hosted account whose graceUntil has passed (request-time, cron-independent)', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn, {
      accountId: 'acct_123',
      subscriptionStatus: 'past_due',
      graceUntil: new Date(Date.now() - 60_000), // grace ended a minute ago
    });
    const res = await app.request('/resource');

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('past due');
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('allows a past_due hosted account still inside its grace window', async () => {
    mockedGetLicensePayload.mockReturnValue(null);
    const queryFn = vi.fn();

    const app = createApp(queryFn, {
      accountId: 'acct_123',
      subscriptionStatus: 'past_due',
      graceUntil: new Date(Date.now() + 3_600_000), // grace still open
    });
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
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
        jti: 'jti_1',
      });

      // First call returns 'active'; subsequent calls return 'revoked' to
      // simulate Stripe-side revocation that arrived between cache-fill +
      // next read.
      const queryFn = vi
        .fn<(payload: LicensePayload) => Promise<string>>()
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
      jti: 'jti_1',
    });

    const queryFn = vi
      .fn<(payload: LicensePayload) => Promise<string>>()
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
