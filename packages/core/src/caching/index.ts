/**
 * Caching utilities for RevealUI applications.
 *
 * - cdn-config: Cache-Control headers, CDN purge, Vercel/Cloudflare config
 * - edge-cache: Next.js ISR presets, revalidation, edge middleware helpers
 */

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
} from './cdn-config';

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
} from './edge-cache';
