/**
 * Cache Store Adapters
 *
 * Pluggable backends for the RevealUI caching layer:
 * - InMemoryCacheStore: Map-backed, zero-dep, single-instance
 * - PGliteCacheStore: PostgreSQL-backed via PGlite, supports distributed invalidation
 */

export { InMemoryCacheStore } from './memory.js';
export { PGliteCacheStore } from './pglite.js';
export type { CacheEntry, CacheStore } from './types.js';
