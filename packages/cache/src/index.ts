/**
 * @revealui/cache — caching infrastructure for RevealUI applications.
 *
 * Runtime surface:
 * - adapters (subpath `@revealui/cache/adapters`): memory, PGlite, browser
 * - createCachedFunction + revalidateTag / revalidatePath (tag-aware CMS data cache)
 * - invalidation-channel: distributed cache busting across store instances
 * - logger: configurable internal logger
 *
 * Edge/CDN helpers were removed as built-but-unwired (C11). Prefer
 * platform-native cache control for HTML/CDN; use this package for app data.
 */

// Adapter types (full implementations via '@revealui/cache/adapters')
export type { CacheEntry, CacheStore } from './adapters/types.js';
// Tag-aware memoization (GAP-194 3.7a)
export type { CreateCachedFunctionOptions } from './cached-function.js';
export {
  buildCachedFunctionKey,
  createCachedFunction,
  serializeCacheArgs,
} from './cached-function.js';
export {
  getDefaultCacheStore,
  resetDefaultCacheStore,
  setDefaultCacheStore,
} from './default-store.js';
// Invalidation channel (distributed cache busting)
export type {
  InvalidationChannelOptions,
  InvalidationEvent,
  InvalidationEventType,
} from './invalidation-channel.js';
export { CacheInvalidationChannel } from './invalidation-channel.js';
export type { CacheLogger } from './logger.js';
export { configureCacheLogger, getCacheLogger } from './logger.js';
export {
  normalizeCachePath,
  pathCacheTag,
  revalidatePath,
  revalidateTag,
} from './revalidate.js';
