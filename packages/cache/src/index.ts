/**
 * @revealui/cache — Caching infrastructure for RevealUI applications.
 *
 * - cdn-config: Cache-Control headers, CDN purge, Vercel/Cloudflare config
 * - edge-cache: Next.js ISR presets, revalidation, edge middleware helpers
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
export type { CacheLogger } from './logger.js';
export { configureCacheLogger, getCacheLogger } from './logger.js';
