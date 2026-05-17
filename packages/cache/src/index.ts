/**
 * @revealui/cache  -  Caching infrastructure for RevealUI applications.
 *
 * Framework-agnostic. Works with NextRequest/NextResponse via structural
 * typing, but the package no longer carries a `next` peer dep. Hono /
 * Cloudflare Workers / plain Web standard runtimes all consume the same
 * surface — see the `CacheRequest` / `CacheResponse` types.
 *
 * - cdn-config: Cache-Control headers, CDN purge, Vercel/Cloudflare config
 * - edge-cache: ISR-style presets, revalidation, edge rate-limit,
 *   geolocation, A/B testing, personalization, cache headers
 * - invalidation-channel: Distributed cache busting
 * - logger: Configurable internal logger (defaults to console)
 */

// Adapter types (full implementations available via '@revealui/cache/adapters')
export type { CacheEntry, CacheStore } from './adapters/types.js';
export type { CDNCacheConfig, CDNPurgeConfig } from './cdn-config.js';
export {
  CDN_CACHE_PRESETS,
  DEFAULT_CDN_CONFIG,
  generateCacheControl,
  generateCacheTags,
  generateCloudflareConfig,
  generateVercelCacheConfig,
  getCacheTTL,
  purgeAllCache,
  purgeCacheByTag,
  purgeCDNCache,
  shouldCacheResponse,
  warmCDNCache,
} from './cdn-config.js';
export type {
  CacheRequest,
  CacheResponse,
  EdgeCacheConfig,
  EdgeRateLimitConfig,
  GeoLocation,
  ISRConfig,
  PersonalizationConfig,
} from './edge-cache.js';
export {
  addPreloadLinks,
  createCachedFunction,
  createEdgeCachedFetch,
  EdgeRateLimiter,
  generateStaticParams,
  getABTestVariant,
  getGeoLocation,
  getPersonalizationConfig,
  ISR_PRESETS,
  revalidatePath,
  revalidatePaths,
  revalidateTag,
  revalidateTags,
  setEdgeCacheHeaders,
  warmISRCache,
} from './edge-cache.js';
// Invalidation channel (distributed cache busting)
export type {
  InvalidationChannelOptions,
  InvalidationEvent,
  InvalidationEventType,
} from './invalidation-channel.js';
export { CacheInvalidationChannel } from './invalidation-channel.js';
export type { CacheLogger } from './logger.js';
export { configureCacheLogger, getCacheLogger } from './logger.js';
