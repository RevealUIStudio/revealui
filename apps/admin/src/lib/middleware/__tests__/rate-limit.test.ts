/**
 * Rate Limiting Middleware Tests
 *
 * Tests for:
 * - extractTrustedIp: XFF rightmost extraction, fallbacks
 * - rateLimit(): factory function returning middleware
 * - withRateLimit(): higher-order handler wrapper
 * - failClosed vs failOpen behavior
 * - Rate limit headers on responses
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    static json(
      data: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ): MockNextResponse {
      return new MockNextResponse(data, init);
    }
  }

  return { NextResponse: MockNextResponse };
});

function makeRequest(
  headers: Record<string, string> = {},
  ip?: string,
): { headers: { get: (key: string) => string | null }; ip?: string } {
  return {
    headers: { get: (key: string) => headers[key] ?? null },
    ip,
  } as never;
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadModule() {
    return import('../rate-limit.js');
  }

  it('returns null when under the limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });

    const result = await limiter(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);
    expect(result).toBeNull();
  });

  it('returns 429 when over the limit', async () => {
    const resetAt = Date.now() + 30000;
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });

    const result = await limiter(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(429);
    expect(
      (result as unknown as { headers: Map<string, string> }).headers.get('X-RateLimit-Limit'),
    ).toBe('5');
    expect(
      (result as unknown as { headers: Map<string, string> }).headers.get('X-RateLimit-Remaining'),
    ).toBe('0');
  });

  it('extracts rightmost IP from X-Forwarded-For', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 10, windowMs: 60000 });

    await limiter(
      makeRequest({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.50' }) as never,
    );

    expect(mockCheckRateLimit).toHaveBeenCalledWith('rate_limit:203.0.113.50', expect.anything());
  });

  it('falls back to x-real-ip when no XFF', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 10, windowMs: 60000 });

    await limiter(makeRequest({ 'x-real-ip': '10.20.30.40' }) as never);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('rate_limit:10.20.30.40', expect.anything());
  });

  it('falls back to request.ip when no headers', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 10, windowMs: 60000 });

    await limiter(makeRequest({}, '99.88.77.66') as never);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('rate_limit:99.88.77.66', expect.anything());
  });

  it('uses "unknown" when no IP source available', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 10, windowMs: 60000 });

    await limiter(makeRequest({}) as never);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('rate_limit:unknown', expect.anything());
  });

  it('allows request when checkRateLimit throws (fail-open default)', async () => {
    mockCheckRateLimit.mockRejectedValue(new Error('Redis down'));
    const { rateLimit } = await loadModule();
    const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });

    const result = await limiter(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);
    expect(result).toBeNull();
  });
});

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadModule() {
    return import('../rate-limit.js');
  }

  it('calls the handler when under the limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { withRateLimit } = await loadModule();
    const { NextResponse } = await import('next/server');

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler, { maxAttempts: 10 });

    const response = await wrapped(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      (response as unknown as { headers: Map<string, string> }).headers.get('X-RateLimit-Limit'),
    ).toBe('10');
  });

  it('returns 429 without calling handler when over the limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });
    const { withRateLimit } = await loadModule();

    const handler = vi.fn();
    const wrapped = withRateLimit(handler, { maxAttempts: 5, keyPrefix: 'auth' });

    const response = await wrapped(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);

    expect(handler).not.toHaveBeenCalled();
    expect((response as { status: number }).status).toBe(429);
  });

  it('uses custom keyPrefix in rate limit key', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    });
    const { withRateLimit } = await loadModule();
    const { NextResponse } = await import('next/server');

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler, { keyPrefix: 'auth' });

    await wrapped(makeRequest({ 'x-forwarded-for': '5.6.7.8' }) as never);

    expect(mockCheckRateLimit).toHaveBeenCalledWith('auth:5.6.7.8', expect.anything());
  });

  it('returns 503 when failClosed and rate limit check fails', async () => {
    mockCheckRateLimit.mockRejectedValue(new Error('Redis down'));
    const { withRateLimit } = await loadModule();

    const handler = vi.fn();
    const wrapped = withRateLimit(handler, { failClosed: true });

    const response = await wrapped(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);

    expect(handler).not.toHaveBeenCalled();
    expect((response as { status: number }).status).toBe(503);
  });

  it('allows request when rate limit check fails and failClosed is false', async () => {
    mockCheckRateLimit.mockRejectedValue(new Error('Redis down'));
    const { withRateLimit } = await loadModule();
    const { NextResponse } = await import('next/server');

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRateLimit(handler);

    await wrapped(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when handler throws', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    });
    const { withRateLimit } = await loadModule();

    const handler = vi.fn().mockRejectedValue(new Error('Handler exploded'));
    const wrapped = withRateLimit(handler);

    const response = await wrapped(makeRequest({ 'x-forwarded-for': '1.2.3.4' }) as never);

    expect((response as { status: number }).status).toBe(500);
    expect((response as unknown as { body: { message: string } }).body).toEqual(
      expect.objectContaining({ error: 'INTERNAL_ERROR' }),
    );
  });
});

describe('rateLimitConfigs', () => {
  it('has correct auth config', async () => {
    const { rateLimitConfigs } = await import('../rate-limit.js');
    expect(rateLimitConfigs.auth).toEqual({ maxRequests: 5, windowMs: 15 * 60 * 1000 });
  });

  it('has correct api config', async () => {
    const { rateLimitConfigs } = await import('../rate-limit.js');
    expect(rateLimitConfigs.api).toEqual({ maxRequests: 100, windowMs: 60 * 1000 });
  });
});
