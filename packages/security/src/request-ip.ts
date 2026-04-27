/**
 * Trusted-proxy-aware client IP extraction.
 *
 * X-Forwarded-For is trivially spoofable by direct clients.
 * This module uses the "rightmost untrusted" strategy: only
 * entries appended by trusted proxies are considered, and the
 * client IP is the first entry NOT written by a trusted proxy.
 *
 * @example
 * ```ts
 * // One-time setup (app init)
 * configureClientIp({ trustedProxyCount: 1 }); // Vercel default
 *
 * // Per-request
 * const ip = getClientIp(request);
 * ```
 */

export interface ClientIpConfig {
  /**
   * Number of trusted reverse proxies between client and app.
   *
   * - `1` (default) — single proxy (Vercel, Fly.io, single nginx)
   * - `2` — two proxies (e.g. Cloudflare → Vercel)
   * - `0` — no trusted proxy; X-Forwarded-For is never read
   *
   * The rightmost N entries in X-Forwarded-For were written by
   * trusted infrastructure. The entry just before them is the
   * client IP as seen by the outermost trusted proxy.
   */
  trustedProxyCount?: number;

  /**
   * Platform-specific header that contains the verified client IP.
   * Takes priority over X-Forwarded-For when present.
   *
   * Examples: `'cf-connecting-ip'` (Cloudflare), `'fly-client-ip'` (Fly.io).
   *
   * Only read when `trustedProxyCount >= 1` (a proxy must exist to set it).
   */
  ipHeader?: string;
}

/** Module-level defaults — set once at app init via `configureClientIp`. */
let defaultConfig: Required<ClientIpConfig> = {
  trustedProxyCount: 1,
  ipHeader: '',
};

/**
 * Set the default config for all subsequent `getClientIp` calls.
 * Typically called once at app startup.
 */
export function configureClientIp(config: ClientIpConfig): void {
  defaultConfig = {
    trustedProxyCount: config.trustedProxyCount ?? 1,
    ipHeader: config.ipHeader ?? '',
  };
}

/**
 * Reset to defaults (for tests).
 */
export function resetClientIpConfig(): void {
  defaultConfig = { trustedProxyCount: 1, ipHeader: '' };
}

/**
 * Extract the client IP from a request using the trusted-proxy strategy.
 *
 * Returns `'unknown'` when the IP cannot be determined (no proxy
 * headers, or proxy trust is disabled).
 */
export function getClientIp(request: Request, config?: ClientIpConfig): string {
  const { trustedProxyCount, ipHeader } = { ...defaultConfig, ...config };

  // No trusted proxy — never read forwarding headers
  if (trustedProxyCount <= 0) {
    return 'unknown';
  }

  // Platform-specific header (e.g. CF-Connecting-IP)
  if (ipHeader) {
    const value = request.headers.get(ipHeader);
    if (value) {
      return value.split(',')[0]!.trim();
    }
  }

  // X-Forwarded-For: client, proxy1, proxy2, ...
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim());

    // The last `trustedProxyCount` entries were added by trusted infra.
    // The entry just before them is the client IP as seen by the
    // outermost trusted proxy — this is the one we trust.
    const clientIndex = parts.length - trustedProxyCount;
    if (clientIndex >= 0 && parts[clientIndex]) {
      return parts[clientIndex];
    }
    // Fewer entries than expected proxies — the only entry was added
    // by a proxy, so parts[0] is the real client IP.
    if (parts[0]) {
      return parts[0];
    }
  }

  // X-Real-IP (set by some proxies instead of X-Forwarded-For)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}
