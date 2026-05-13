import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'free'),
}));

import { checkRateLimit } from '@revealui/auth/server';
import { getCurrentTier } from '@revealui/core/license';
import { configureClientIp, resetClientIpConfig } from '@revealui/security';
import { rateLimitMiddleware, tieredRateLimitMiddleware } from '../rate-limit.js';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCurrentTier = vi.mocked(getCurrentTier);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentTier.mockReturnValue('free');
  // Match production wiring at apps/server/src/index.ts:1326.
  configureClientIp({ trustedProxyCount: 1 });
});

afterEach(() => {
  resetClientIpConfig();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function allowedResult(remaining = 99) {
  return { allowed: true, remaining, resetAt: Date.now() + 60_000 };
}

function blockedResult() {
  return { allowed: false, remaining: 0, resetAt: Date.now() + 30_000 };
}

// ---------------------------------------------------------------------------
// Tests  -  rateLimitMiddleware
// ---------------------------------------------------------------------------
describe('rateLimitMiddleware', () => {
  it('allows requests when under the limit', async () => {
    mockedCheckRateLimit.mockResolvedValue(allowedResult(42));

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue(blockedResult());

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(429);
  });

  it('sets X-RateLimit-Limit header', async () => {
    mockedCheckRateLimit.mockResolvedValue(allowedResult(50));

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('sets X-RateLimit-Remaining header', async () => {
    mockedCheckRateLimit.mockResolvedValue(allowedResult(42));

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Remaining')).toBe('42');
  });

  it('sets X-RateLimit-Reset header', async () => {
    const result = allowedResult();
    mockedCheckRateLimit.mockResolvedValue(result);

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Reset')).toBe(String(result.resetAt));
  });

  it('sets Retry-After header when blocked', async () => {
    const resetAt = Date.now() + 30_000;
    mockedCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt });

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);
  });

  describe('IP extraction (trusted-proxy-aware, post-revealui#838)', () => {
    it('uses the entry written by the trusted edge proxy (X-Forwarded-For)', async () => {
      // With trustedProxyCount=1 and parts=[1.1.1.1, 2.2.2.2, 3.3.3.3],
      // the rightmost entry (3.3.3.3) is what our trusted proxy wrote — the
      // IP of whoever connected to it. The leftmost two entries are
      // untrusted (could be a client-set spoof + an untrusted upstream).
      mockedCheckRateLimit.mockResolvedValue(allowedResult());

      const app = new Hono();
      app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' },
      });

      const key = mockedCheckRateLimit.mock.calls[0]![0];
      expect(key).toBe('api:3.3.3.3');
    });

    it('rejects a crafted X-Forwarded-For prefix (spoof bypass attempt)', async () => {
      // Attacker sets X-Forwarded-For: "9.9.9.9" before the request hits
      // the trusted proxy. The trusted proxy appends the attacker's TCP
      // peer IP (5.5.5.5). With trustedProxyCount=1, getClientIp returns
      // 5.5.5.5 — the real attacker IP, not the spoofed 9.9.9.9.
      // Per revealui#838 acceptance criterion.
      mockedCheckRateLimit.mockResolvedValue(allowedResult());

      const app = new Hono();
      app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { 'x-forwarded-for': '9.9.9.9, 5.5.5.5' },
      });

      const key = mockedCheckRateLimit.mock.calls[0]![0];
      expect(key).toBe('api:5.5.5.5');
      expect(key).not.toBe('api:9.9.9.9');
    });

    it('uses X-Forwarded-For over X-Real-IP when both present (trusted-proxy strategy)', async () => {
      // Behavior change vs the pre-revealui#838 middleware (which preferred
      // X-Real-IP unconditionally). The trusted-proxy strategy treats
      // X-Forwarded-For as the canonical source when present, since it
      // encodes the full proxy chain we can apply trustedProxyCount to.
      // X-Real-IP is only a fallback when XFF is absent.
      mockedCheckRateLimit.mockResolvedValue(allowedResult());

      const app = new Hono();
      app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: {
          'x-real-ip': '9.9.9.9',
          'x-forwarded-for': '1.1.1.1, 2.2.2.2',
        },
      });

      const key = mockedCheckRateLimit.mock.calls[0]![0];
      expect(key).toBe('api:2.2.2.2');
    });

    it('falls back to X-Real-IP when X-Forwarded-For is absent', async () => {
      mockedCheckRateLimit.mockResolvedValue(allowedResult());

      const app = new Hono();
      app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { 'x-real-ip': '4.4.4.4' },
      });

      const key = mockedCheckRateLimit.mock.calls[0]![0];
      expect(key).toBe('api:4.4.4.4');
    });

    it('uses "unknown" when no IP headers are present', async () => {
      mockedCheckRateLimit.mockResolvedValue(allowedResult());

      const app = new Hono();
      app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');

      const key = mockedCheckRateLimit.mock.calls[0]![0];
      expect(key).toBe('api:unknown');
    });
  });

  it('uses keyPrefix in rate limit key', async () => {
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 100, windowMs: 60_000, keyPrefix: 'billing' }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', {
      headers: { 'x-real-ip': '5.5.5.5' },
    });

    const key = mockedCheckRateLimit.mock.calls[0]![0];
    expect(key).toBe('billing:5.5.5.5');
  });

  it('passes maxRequests and windowMs to checkRateLimit', async () => {
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 200, windowMs: 120_000 }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(mockedCheckRateLimit).toHaveBeenCalledWith(expect.any(String), {
      maxAttempts: 200,
      windowMs: 120_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  tieredRateLimitMiddleware
// ---------------------------------------------------------------------------
describe('tieredRateLimitMiddleware', () => {
  const tierConfig = {
    free: { maxRequests: 50, windowMs: 60_000 },
    pro: { maxRequests: 200, windowMs: 60_000 },
    max: { maxRequests: 500, windowMs: 60_000 },
    enterprise: { maxRequests: 1000, windowMs: 60_000 },
  };

  it('uses the correct tier limits for pro', async () => {
    mockedGetCurrentTier.mockReturnValue('pro');
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', tieredRateLimitMiddleware({ tiers: tierConfig }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('200');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(expect.any(String), {
      maxAttempts: 200,
      windowMs: 60_000,
    });
  });

  it('includes tier in the rate limit key', async () => {
    mockedGetCurrentTier.mockReturnValue('max');
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', tieredRateLimitMiddleware({ tiers: tierConfig }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', {
      headers: { 'x-real-ip': '6.6.6.6' },
    });

    const key = mockedCheckRateLimit.mock.calls[0]![0];
    expect(key).toBe('api:max:6.6.6.6');
  });

  it('falls back to free tier when tier is not in config', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test  -  simulating unknown tier value
    mockedGetCurrentTier.mockReturnValue('unknown-tier' as any);
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', tieredRateLimitMiddleware({ tiers: tierConfig }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Limit')).toBe('50');
  });

  it('returns 429 when tiered limit exceeded', async () => {
    mockedGetCurrentTier.mockReturnValue('free');
    mockedCheckRateLimit.mockResolvedValue(blockedResult());

    const app = new Hono();
    app.use('*', tieredRateLimitMiddleware({ tiers: tierConfig }));
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(429);
  });

  it('uses keyPrefix with tier in rate limit key', async () => {
    mockedGetCurrentTier.mockReturnValue('enterprise');
    mockedCheckRateLimit.mockResolvedValue(allowedResult());

    const app = new Hono();
    app.use('*', tieredRateLimitMiddleware({ tiers: tierConfig, keyPrefix: 'webhooks' }));
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', {
      headers: { 'x-real-ip': '7.7.7.7' },
    });

    const key = mockedCheckRateLimit.mock.calls[0]![0];
    expect(key).toBe('webhooks:enterprise:7.7.7.7');
  });
});
