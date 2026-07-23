/**
 * @revealui/cache — caching infrastructure for RevealUI applications.
 *
 * Runtime surface (C11 2026-07-23):
 * - adapters (subpath `@revealui/cache/adapters`): memory, PGlite, browser
 * - invalidation-channel: distributed cache busting across store instances
 * - logger: configurable internal logger
 *
 * Edge/CDN helpers (`edge-cache.ts`, `cdn-config.ts`) were deleted as
 * built-but-unwired (tests-only, zero app consumers). Prefer platform-native
 * cache control (e.g. `next/cache`, CDN provider APIs) at the app boundary.
 */

// Adapter types (full implementations via '@revealui/cache/adapters')
export type { CacheEntry, CacheStore } from './adapters/types.js';
// Invalidation channel (distributed cache busting)
export type {
  InvalidationChannelOptions,
  InvalidationEvent,
  InvalidationEventType,
} from './invalidation-channel.js';
export { CacheInvalidationChannel } from './invalidation-channel.js';
export type { CacheLogger } from './logger.js';
export { configureCacheLogger, getCacheLogger } from './logger.js';
