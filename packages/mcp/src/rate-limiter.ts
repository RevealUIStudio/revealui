/**
 * MCP Rate Limiter
 *
 * In-memory fixed-window rate limiter scoped by tenant + tier.
 * For distributed deployments, replace with a Redis-backed implementation.
 *
 * @example
 * ```typescript
 * const limiter = new McpRateLimiter();
 *
 * const result = limiter.check('tenant-123', 'pro');
 * if (!result.allowed) {
 *   throw new Error(`Rate limited. Retry after ${result.resetMs}ms`);
 * }
 * // result.remaining === requests left in window
 * ```
 */

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
// Internal types
// =============================================================================

interface WindowEntry {
  count: number;
  windowStart: number;
}

// =============================================================================
// Rate limiter
// =============================================================================

/**
 * In-memory fixed-window rate limiter scoped by tenant + tier.
 * For distributed deployments, replace with a Redis-backed implementation.
 */
export class McpRateLimiter {
  private windows = new Map<string, WindowEntry>();
  private limits: Record<string, RateLimitConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(limits: Record<string, RateLimitConfig> = DEFAULT_TIER_LIMITS) {
    this.limits = limits;
    // Clean up expired windows every 60s
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Check if a request is allowed and consume one token if so.
   * Returns quota information including remaining requests and reset time.
   */
  check(tenantId: string, tier: string): RateLimitResult {
    const config = this.limits[tier] ?? this.limits.free ?? { maxRequests: 60, windowMs: 60_000 };
    const key = `${tenantId}:${tier}`;
    const now = Date.now();

    let entry = this.windows.get(key);

    // New window or expired window
    if (!entry || now - entry.windowStart >= config.windowMs) {
      entry = { count: 0, windowStart: now };
      this.windows.set(key, entry);
    }

    const resetMs = config.windowMs - (now - entry.windowStart);

    if (entry.count >= config.maxRequests) {
      return { allowed: false, remaining: 0, limit: config.maxRequests, resetMs };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - entry.count),
      limit: config.maxRequests,
      resetMs,
    };
  }

  /** Override limits for a specific tier. */
  setTierLimit(tier: string, config: RateLimitConfig): void {
    this.limits[tier] = config;
  }

  /** Clean up expired window entries. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      const tier = key.split(':')[1] ?? 'free';
      const config = this.limits[tier] ?? { windowMs: 60_000 };
      if (now - entry.windowStart >= config.windowMs * 2) {
        this.windows.delete(key);
      }
    }
  }

  /** Dispose the rate limiter, clearing the cleanup timer and all windows. */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
  }
}
