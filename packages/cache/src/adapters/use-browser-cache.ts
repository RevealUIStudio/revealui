'use client';

/**
 * React hook for browser-side PGlite cache.
 *
 * Provides a singleton CacheStore instance backed by PGlite WASM + IndexedDB.
 * The cache is created lazily on first access and shared across all components.
 * Handles cleanup on unmount of the last consumer.
 */

import { useEffect, useRef, useState } from 'react';
import type { CacheStore } from './types.js';

// Singleton state shared across all hook instances
let sharedCache: CacheStore | null = null;
let initPromise: Promise<CacheStore> | null = null;
let refCount = 0;

async function getOrCreateCache(): Promise<CacheStore> {
  if (sharedCache) return sharedCache;
  if (initPromise) return initPromise;

  initPromise = import('./browser.js').then(async (mod) => {
    const cache = await mod.createBrowserCache();
    sharedCache = cache;
    return cache;
  });

  return initPromise;
}

interface UseBrowserCacheResult {
  /** The PGlite-backed CacheStore instance. Null while initializing. */
  cache: CacheStore | null;
  /** Whether the cache is still being initialized. */
  loading: boolean;
  /** Initialization error, if any. */
  error: Error | null;
}

/**
 * Access the browser-side PGlite cache store.
 *
 * Returns a shared singleton CacheStore. Multiple components can
 * use this hook without creating duplicate PGlite instances.
 *
 * Example:
 *   const { cache, loading } = useBrowserCache();
 *   if (!loading && cache) {
 *     const data = await cache.get('posts:recent');
 *   }
 */
export function useBrowserCache(): UseBrowserCacheResult {
  const [cache, setCache] = useState<CacheStore | null>(sharedCache);
  const [loading, setLoading] = useState(!sharedCache);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    refCount++;

    if (!sharedCache) {
      getOrCreateCache()
        .then((c) => {
          if (mounted.current) {
            setCache(c);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (mounted.current) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        });
    }

    return () => {
      mounted.current = false;
      refCount--;

      // Close the cache when no components are using it
      if (refCount === 0 && sharedCache) {
        sharedCache.close().catch(() => {});
        sharedCache = null;
        initPromise = null;
      }
    };
  }, []);

  return { cache, loading, error };
}
