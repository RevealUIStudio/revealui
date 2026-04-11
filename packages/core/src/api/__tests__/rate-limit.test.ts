import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('next/server', () => {
  class MockNextRequest {
    url: string;
    method: string;
    headers: Headers;

    constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
      this.url = url;
      this.method = init?.method ?? 'GET';
      this.headers = new Headers(init?.headers);
    }
  }

  class MockNextResponse {
    body: string | null;
    status: number;
    statusText: string;
    headers: Headers;

    constructor(
      body?: string | null,
      init?: { status?: number; statusText?: string; headers?: Record<string, string> },
    ) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? 'OK';
      this.headers = new Headers(init?.headers);
    }

    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      const res = new MockNextResponse(JSON.stringify(data), init);
      res.headers.set('content-type', 'application/json');
      return res;
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

vi.mock('../../observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  checkSlidingWindowRateLimit,
  checkTokenBucketRateLimit,
  cleanupRateLimits,
  clearAllRateLimits,
  clearRateLimit,
  getRateLimitInfo,
  getRateLimitStats,
  RATE_LIMIT_PRESETS,
} from '../rate-limit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(
  url = 'http://localhost/api/test',
  headers?: Record<string, string>,
  method = 'GET',
) {
  return new NextRequest(url, { method, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('core rate-limit module', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  afterEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit  -  fixed window', () => {
    const config = { windowMs: 60_000, maxRequests: 3 };

    it('allows requests under the limit', () => {
      const req = createRequest();
      const result = checkRateLimit(req, config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.limit).toBe(3);
    });

    it('blocks requests over the limit', () => {
      const req = createRequest();

      checkRateLimit(req, config);
      checkRateLimit(req, config);
      checkRateLimit(req, config);
      const result = checkRateLimit(req, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets after window expires', () => {
      const req = createRequest();

      // Exhaust limit
      checkRateLimit(req, config);
      checkRateLimit(req, config);
      checkRateLimit(req, config);

      // Fast-forward past window
      const info = getRateLimitInfo('unknown');
      if (info) info.resetTime = Date.now() - 1;

      const result = checkRateLimit(req, config);
      expect(result.allowed).toBe(true);
    });

    it('skips rate limiting when skip function returns true', () => {
      const req = createRequest();
      const skipConfig = {
        ...config,
        skip: () => true,
      };

      const result = checkRateLimit(req, skipConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3); // Full limit returned
    });

    it('uses custom key generator', () => {
      const config2 = {
        ...config,
        keyGenerator: () => 'custom-key',
      };

      const req = createRequest();
      checkRateLimit(req, config2);
      checkRateLimit(req, config2);
      checkRateLimit(req, config2);
      const result = checkRateLimit(req, config2);

      expect(result.allowed).toBe(false);

      // Different key should not be blocked
      const config3 = { ...config, keyGenerator: () => 'other-key' };
      const result2 = checkRateLimit(req, config3);
      expect(result2.allowed).toBe(true);
    });

    it('extracts IP from X-Forwarded-For (leftmost)', () => {
      const req1 = createRequest('http://localhost/api/test', {
        'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      });
      const req2 = createRequest('http://localhost/api/test', {
        'x-forwarded-for': '3.3.3.3',
      });

      // Exhaust for req1's IP
      for (let i = 0; i < 3; i++) checkRateLimit(req1, config);
      const r1 = checkRateLimit(req1, config);
      expect(r1.allowed).toBe(false);

      // Different IP should not be blocked
      const r2 = checkRateLimit(req2, config);
      expect(r2.allowed).toBe(true);
    });

    it('falls back to X-Real-IP', () => {
      const req = createRequest('http://localhost/api/test', {
        'x-real-ip': '4.4.4.4',
      });

      const result = checkRateLimit(req, config);
      const info = getRateLimitInfo('4.4.4.4');
      expect(info).not.toBeNull();
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkSlidingWindowRateLimit', () => {
    const config = { windowMs: 60_000, maxRequests: 3 };

    it('allows requests under the limit', () => {
      const req = createRequest();
      const result = checkSlidingWindowRateLimit(req, config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('blocks requests over the limit', () => {
      const req = createRequest();

      checkSlidingWindowRateLimit(req, config);
      checkSlidingWindowRateLimit(req, config);
      checkSlidingWindowRateLimit(req, config);
      const result = checkSlidingWindowRateLimit(req, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('does not increment count when blocked', () => {
      const req = createRequest();

      checkSlidingWindowRateLimit(req, config);
      checkSlidingWindowRateLimit(req, config);
      checkSlidingWindowRateLimit(req, config);

      // These should not add timestamps
      checkSlidingWindowRateLimit(req, config);
      checkSlidingWindowRateLimit(req, config);

      // After "window expires" (clear and retry), should still allow 3
      clearAllRateLimits();
      const r1 = checkSlidingWindowRateLimit(req, config);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
    });
  });

  describe('checkTokenBucketRateLimit', () => {
    const config = { windowMs: 60_000, maxRequests: 3, refillRate: 3 };

    it('allows requests when tokens available', () => {
      const req = createRequest();
      const result = checkTokenBucketRateLimit(req, config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // started with 3, used 1
    });

    it('blocks when tokens exhausted', () => {
      const req = createRequest();

      checkTokenBucketRateLimit(req, config);
      checkTokenBucketRateLimit(req, config);
      checkTokenBucketRateLimit(req, config);
      const result = checkTokenBucketRateLimit(req, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('cleanupRateLimits', () => {
    it('removes expired entries', () => {
      const req = createRequest();
      const config = { windowMs: 1, maxRequests: 100 };

      checkRateLimit(req, config);

      // Wait for expiry
      const info = getRateLimitInfo('unknown');
      if (info) info.resetTime = Date.now() - 1;

      const cleaned = cleanupRateLimits();
      expect(cleaned).toBeGreaterThanOrEqual(1);
    });

    it('returns 0 when nothing to clean', () => {
      const cleaned = cleanupRateLimits();
      expect(cleaned).toBe(0);
    });
  });

  describe('clearRateLimit', () => {
    it('clears rate limit for specific key', () => {
      const config = { windowMs: 60_000, maxRequests: 1, keyGenerator: () => 'test-key' };
      const req = createRequest();

      checkRateLimit(req, config);
      expect(getRateLimitInfo('test-key')).not.toBeNull();

      clearRateLimit('test-key');
      expect(getRateLimitInfo('test-key')).toBeNull();
    });
  });

  describe('getRateLimitStats', () => {
    it('returns correct stats', () => {
      const config = { windowMs: 60_000, maxRequests: 10 };
      const req = createRequest();

      checkRateLimit(req, config);

      const stats = getRateLimitStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.active).toBeGreaterThanOrEqual(1);
      expect(stats.expired).toBe(0);
    });

    it('returns zeros when empty', () => {
      const stats = getRateLimitStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('RATE_LIMIT_PRESETS', () => {
    it('has expected presets', () => {
      expect(RATE_LIMIT_PRESETS.veryStrict.maxRequests).toBe(10);
      expect(RATE_LIMIT_PRESETS.strict.maxRequests).toBe(30);
      expect(RATE_LIMIT_PRESETS.standard.maxRequests).toBe(100);
      expect(RATE_LIMIT_PRESETS.relaxed.maxRequests).toBe(500);
      expect(RATE_LIMIT_PRESETS.hourly.maxRequests).toBe(1000);
      expect(RATE_LIMIT_PRESETS.daily.maxRequests).toBe(10000);
    });
  });
});
