import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
}));

vi.mock('@revealui/core/license', () => ({
  getCurrentTier: vi.fn(() => 'free'),
}));

import { checkRateLimit } from '@revealui/auth/server';
import { getCurrentTier } from '@revealui/core/license';
import { tieredRateLimitMiddleware } from '../rate-limit.js';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetCurrentTier = vi.mocked(getCurrentTier);

const TIERS = {
  free: { maxRequests: 200, windowMs: 60_000 },
  pro: { maxRequests: 300, windowMs: 60_000 },
  max: { maxRequests: 600, windowMs: 60_000 },
  enterprise: { maxRequests: 1000, windowMs: 60_000 },
} as const;

function createApp() {
  const app = new Hono();
  app.use('/*', tieredRateLimitMiddleware({ tiers: TIERS, keyPrefix: 'test' }));
  app.get('/resource', (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('tieredRateLimitMiddleware', () => {
  it('uses free tier limits for free license', async () => {
    mockedGetCurrentTier.mockReturnValue('free');
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 199,
      resetAt: Date.now() + 60_000,
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('200');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('test:free:'),
      expect.objectContaining({ maxAttempts: 200 }),
    );
  });

  it('uses pro tier limits for pro license', async () => {
    mockedGetCurrentTier.mockReturnValue('pro');
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 299,
      resetAt: Date.now() + 60_000,
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('300');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('test:pro:'),
      expect.objectContaining({ maxAttempts: 300 }),
    );
  });

  it('uses enterprise tier limits for enterprise license', async () => {
    mockedGetCurrentTier.mockReturnValue('enterprise');
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 999,
      resetAt: Date.now() + 60_000,
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('1000');
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockedGetCurrentTier.mockReturnValue('free');
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });

    const app = createApp();
    const res = await app.request('/resource');

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('includes tier in rate limit key for counter isolation', async () => {
    mockedGetCurrentTier.mockReturnValue('pro');
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 299,
      resetAt: Date.now() + 60_000,
    });

    const app = createApp();
    await app.request('/resource', { headers: { 'x-forwarded-for': '1.2.3.4' } });

    expect(mockedCheckRateLimit).toHaveBeenCalledWith('test:pro:1.2.3.4', expect.anything());
  });
});
