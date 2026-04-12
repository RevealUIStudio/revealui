/**
 * Browser PGlite Cache Store
 *
 * Creates a PGlite WASM instance in the browser backed by IndexedDB,
 * then wraps it with PGliteCacheStore for SQL-powered client-side caching.
 *
 * Benefits over localStorage:
 * - SQL queries for filtering cached data
 * - Tag-based and prefix-based invalidation
 * - IndexedDB storage (much larger than localStorage's ~5MB)
 * - Shared CacheStore interface with server-side cache
 *
 * Usage:
 *   const cache = await createBrowserCache();
 *   await cache.set('posts:123', postData, 3600, ['posts']);
 *   const data = await cache.get('posts:123');
 *   await cache.close(); // on unmount
 */

import { PGliteCacheStore } from './pglite.js';
import type { CacheStore } from './types.js';

interface BrowserCacheOptions {
  /** IndexedDB database name for persistence (default: 'revealui-cache') */
  dbName?: string;
}

/**
 * Create a browser-compatible PGlite cache store.
 *
 * Dynamically imports @electric-sql/pglite (WASM) to avoid bundling
 * it in server builds. The PGlite instance uses IndexedDB for persistence
 * so cached data survives page reloads.
 */
export async function createBrowserCache(options?: BrowserCacheOptions): Promise<CacheStore> {
  const dbName = options?.dbName ?? 'revealui-cache';

  // Dynamic import to avoid bundling PGlite WASM in server builds
  const { PGlite } = await import('@electric-sql/pglite');

  const db = new PGlite(`idb://${dbName}`);
  await db.waitReady;

  return new PGliteCacheStore({
    db,
    closeOnDestroy: true,
  });
}
