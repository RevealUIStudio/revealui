/**
 * Cache Store Adapters
 *
 * Pluggable backends for the RevealUI caching layer:
 * - InMemoryCacheStore: Map-backed, zero-dep, single-instance
 * - PGliteCacheStore: PostgreSQL-backed via PGlite, supports distributed invalidation
 * - createBrowserCache: PGlite WASM + IndexedDB for offline-first browser caching
 * - useBrowserCache: React hook for singleton browser cache access
 */

export { createBrowserCache } from './browser.js';
export { InMemoryCacheStore } from './memory.js';
export { PGliteCacheStore } from './pglite.js';
export type { CacheEntry, CacheStore } from './types.js';
export { useBrowserCache } from './use-browser-cache.js';
