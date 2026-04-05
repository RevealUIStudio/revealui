/**
 * MCP Rate Limiter
 *
 * Fixed-window rate limiter scoped by tenant + tier.
 * Supports pluggable storage backends via RateLimitStore:
 * - InMemoryRateLimitStore (default, Map-backed)
 * - PGliteRateLimitStore (SQL-backed, persistent)
 *
 * @example
 * ```typescript
 * // In-memory (default)
 * const limiter = new McpRateLimiter();
 *
 * // PGlite-backed
 * import { PGlite } from '@electric-sql/pglite';
 * import { PGliteRateLimitStore } from './rate-limit-store.js';
 * const db = new PGlite();
 * const limiter = new McpRateLimiter({
 *   store: new PGliteRateLimitStore({ db }),
 * });
 *
 * const result = await limiter.check('tenant-123', 'pro');
 * if (!result.allowed) {
 *   throw new Error(`Rate limited. Retry after ${result.resetMs}ms`);
 * }
 * ```
 */

import { InMemoryRateLimitStore, type RateLimitStore } from './rate-limit-store.js';

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}

export interface McpRateLimiterOptions {
  /** Tier-based rate limit configuration. */
  limits?: Record<string, RateLimitConfig>;
  /** Storage backend (default: InMemoryRateLimitStore). */
  store?: RateLimitStore;
}

// =============================================================================
// Default tier limits
// =============================================================================

/** Default rate limits per tier. */
export const DEFAULT_TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: { maxRequests: 60, windowMs: 60_000 },
  pro: { maxRequests: 300, windowMs: 60_000 },
  max: { maxRequests: 1000, windowMs: 60_000 },
  enterprise: { maxRequests: 5000, windowMs: 60_000 },
};

// =============================================================================
// Rate limiter
// =============================================================================

/**
 * Fixed-window rate limiter scoped by tenant + tier.
 * Accepts a pluggable RateLimitStore for different storage backends.
 */
export class McpRateLimiter {
  private store: RateLimitStore;
  private limits: Record<string, RateLimitConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: McpRateLimiterOptions = {}) {
    this.limits = options.limits ?? DEFAULT_TIER_LIMITS;
    this.store = options.store ?? new InMemoryRateLimitStore();
    // Clean up expired windows every 60s
    this.cleanupInterval = setInterval(() => {
      void this.cleanup();
    }, 60_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Check if a request is allowed and consume one token if so.
   * Returns quota information including remaining requests and reset time.
   */
  async check(tenantId: string, tier: string): Promise<RateLimitResult> {
    const config = this.limits[tier] ?? this.limits.free ?? { maxRequests: 60, windowMs: 60_000 };
    const key = `${tenantId}:${tier}`;
    const now = Date.now();

    let entry = await this.store.get(key);

    // New window or expired window
    if (!entry || now - entry.windowStart >= config.windowMs) {
      entry = { count: 0, windowStart: now };
      await this.store.set(key, entry);
    }

    const resetMs = config.windowMs - (now - entry.windowStart);

    if (entry.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, limit: config.maxRequests, resetMs };
    }

    const newCount = await this.store.increment(key);
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - newCount),
      limit: config.maxRequests,
      resetMs,
    };
  }

  /** Override limits for a specific tier. */
  setTierLimit(tier: string, config: RateLimitConfig): void {
    this.limits[tier] = config;
  }

  /** Clean up expired window entries. */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    // Use the longest window duration × 2 as the expiry cutoff
    const maxWindowMs = Math.max(...Object.values(this.limits).map((c) => c.windowMs));
    await this.store.cleanup(now - maxWindowMs * 2);
  }

  /** Dispose the rate limiter, clearing the cleanup timer and all windows. */
  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await this.store.close();
  }
}
