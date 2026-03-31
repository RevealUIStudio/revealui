import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIER_LIMITS, McpRateLimiter } from '../rate-limiter.js';

describe('McpRateLimiter', () => {
  let limiter: McpRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new McpRateLimiter();
  });

  afterEach(() => {
    limiter.dispose();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Default tier limits
  // -------------------------------------------------------------------------

  describe('DEFAULT_TIER_LIMITS', () => {
    it('has limits for all standard tiers', () => {
      expect(DEFAULT_TIER_LIMITS).toHaveProperty('free');
      expect(DEFAULT_TIER_LIMITS).toHaveProperty('pro');
      expect(DEFAULT_TIER_LIMITS).toHaveProperty('max');
      expect(DEFAULT_TIER_LIMITS).toHaveProperty('enterprise');
    });

    it('increases limits with higher tiers', () => {
      expect(DEFAULT_TIER_LIMITS.free!.maxRequests).toBeLessThan(
        DEFAULT_TIER_LIMITS.pro!.maxRequests,
      );
      expect(DEFAULT_TIER_LIMITS.pro!.maxRequests).toBeLessThan(
        DEFAULT_TIER_LIMITS.max!.maxRequests,
      );
      expect(DEFAULT_TIER_LIMITS.max!.maxRequests).toBeLessThan(
        DEFAULT_TIER_LIMITS.enterprise!.maxRequests,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Basic check behavior
  // -------------------------------------------------------------------------

  describe('check()', () => {
    it('allows first request', () => {
      const result = limiter.check('tenant-1', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free!.maxRequests - 1);
      expect(result.limit).toBe(DEFAULT_TIER_LIMITS.free!.maxRequests);
    });

    it('decrements remaining on each call', () => {
      const r1 = limiter.check('tenant-1', 'free');
      const r2 = limiter.check('tenant-1', 'free');
      expect(r2.remaining).toBe(r1.remaining - 1);
    });

    it('blocks when limit is exhausted', () => {
      const max = DEFAULT_TIER_LIMITS.free!.maxRequests;
      for (let i = 0; i < max; i++) {
        expect(limiter.check('tenant-1', 'free').allowed).toBe(true);
      }
      const blocked = limiter.check('tenant-1', 'free');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('resets after window expires', () => {
      const max = DEFAULT_TIER_LIMITS.free!.maxRequests;
      for (let i = 0; i < max; i++) {
        limiter.check('tenant-1', 'free');
      }
      expect(limiter.check('tenant-1', 'free').allowed).toBe(false);

      // Advance past window
      vi.advanceTimersByTime(DEFAULT_TIER_LIMITS.free!.windowMs);

      const result = limiter.check('tenant-1', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(max - 1);
    });

    it('returns positive resetMs within window', () => {
      const result = limiter.check('tenant-1', 'free');
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(DEFAULT_TIER_LIMITS.free!.windowMs);
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('tracks tenants independently', () => {
      const max = DEFAULT_TIER_LIMITS.free!.maxRequests;
      for (let i = 0; i < max; i++) {
        limiter.check('tenant-1', 'free');
      }
      expect(limiter.check('tenant-1', 'free').allowed).toBe(false);
      expect(limiter.check('tenant-2', 'free').allowed).toBe(true);
    });

    it('tracks same tenant with different tiers independently', () => {
      const freeMax = DEFAULT_TIER_LIMITS.free!.maxRequests;
      for (let i = 0; i < freeMax; i++) {
        limiter.check('tenant-1', 'free');
      }
      expect(limiter.check('tenant-1', 'free').allowed).toBe(false);
      // Same tenant, different tier — separate window
      expect(limiter.check('tenant-1', 'pro').allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Tier-specific limits
  // -------------------------------------------------------------------------

  describe('tier-specific limits', () => {
    it('applies pro limits for pro tier', () => {
      const result = limiter.check('tenant-1', 'pro');
      expect(result.limit).toBe(DEFAULT_TIER_LIMITS.pro!.maxRequests);
    });

    it('falls back to free limits for unknown tier', () => {
      const result = limiter.check('tenant-1', 'unknown-tier');
      expect(result.limit).toBe(DEFAULT_TIER_LIMITS.free!.maxRequests);
    });
  });

  // -------------------------------------------------------------------------
  // setTierLimit
  // -------------------------------------------------------------------------

  describe('setTierLimit()', () => {
    it('overrides limits for a tier', () => {
      limiter.setTierLimit('free', { maxRequests: 5, windowMs: 10_000 });
      const result = limiter.check('tenant-1', 'free');
      expect(result.limit).toBe(5);
    });

    it('allows adding custom tiers', () => {
      limiter.setTierLimit('custom', { maxRequests: 10, windowMs: 5_000 });
      const result = limiter.check('tenant-1', 'custom');
      expect(result.limit).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // Custom limits in constructor
  // -------------------------------------------------------------------------

  describe('custom constructor limits', () => {
    it('accepts custom limits', () => {
      const custom = new McpRateLimiter({
        test: { maxRequests: 3, windowMs: 1_000 },
      });
      const result = custom.check('t', 'test');
      expect(result.limit).toBe(3);
      custom.dispose();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('removes expired entries after cleanup interval', () => {
      limiter.check('tenant-1', 'free');

      // Advance past 2x window (cleanup threshold) + cleanup interval (60s)
      vi.advanceTimersByTime(DEFAULT_TIER_LIMITS.free!.windowMs * 2 + 60_001);

      // Next check creates a fresh window (the old one was cleaned up)
      const result = limiter.check('tenant-1', 'free');
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free!.maxRequests - 1);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe('dispose()', () => {
    it('clears all state', () => {
      limiter.check('tenant-1', 'free');
      limiter.dispose();

      // After dispose, a new check starts fresh
      const result = limiter.check('tenant-1', 'free');
      expect(result.remaining).toBe(DEFAULT_TIER_LIMITS.free!.maxRequests - 1);
    });
  });
});
