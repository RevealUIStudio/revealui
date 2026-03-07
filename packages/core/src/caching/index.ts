/**
 * Caching utilities for RevealUI applications.
 *
 * - app-cache: React Query/SWR config, cache key generation, optimistic updates
 * - cdn-config: Cache-Control headers, CDN purge, Vercel/Cloudflare config
 * - edge-cache: Next.js ISR presets, revalidation, edge middleware helpers
 */

export type { ReactQueryConfig, SWRConfig } from './app-cache'
export {
  CacheInvalidator,
  CacheKeyGenerator,
  CachePersistence,
  CachePrefetcher,
  CacheStatsTracker,
  DEFAULT_REACT_QUERY_CONFIG,
  DEFAULT_SWR_CONFIG,
  OptimisticUpdater,
  QueryDeduplicator,
} from './app-cache'

export {
  CDN_CACHE_PRESETS,
  generateCacheControl,
  generateCacheTags,
  generateCloudflareConfig,
  generateVercelCacheConfig,
  getCacheTTL,
  purgeCDNCache,
  shouldCacheResponse,
  warmCDNCache,
} from './cdn-config'

export {
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
} from './edge-cache'
