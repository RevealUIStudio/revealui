'use client';

import { useShape } from '@electric-sql/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { toRecords } from '../shape-utils.js';
import { useOnlineStatus } from './useOnlineStatus.js';

/** Default time-to-live for cached data (seconds). */
const DEFAULT_TTL_SECONDS = 3600;

/** Tag prefix applied to all offline cache entries for bulk invalidation. */
const OFFLINE_CACHE_TAG = 'offline-cache';

interface UseOfflineCacheOptions {
  /** ElectricSQL shape subscription URL. */
  shapeUrl: string;
  /** Unique key for the cache entry. */
  cacheKey: string;
  /** How long cached data is considered fresh (seconds). Defaults to 3600. */
  ttlSeconds?: number;
  /** Additional cache tags for targeted invalidation. */
  tags?: string[];
}

interface UseOfflineCacheResult<T> {
  /** The current data: live from the shape when online, cached when offline. */
  data: T[];
  /** Whether the browser has network connectivity. */
  isOnline: boolean;
  /** Whether the shape subscription is currently loading fresh data. */
  isSyncing: boolean;
  /** Timestamp of the most recent successful sync to cache. */
  lastSyncedAt: Date | null;
  /** Shape subscription or cache-read error, if any. */
  error: Error | null;
  /** Manually invalidate the cache for this key. */
  invalidate: () => Promise<void>;
}

// ─── PGlite browser cache singleton ──────────────────────────────────────────

interface CacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number, tags?: string[]): Promise<void>;
  delete(...keys: string[]): Promise<number>;
  close(): Promise<void>;
}

let browserCache: CacheStore | null = null;
let cacheInitPromise: Promise<CacheStore | null> | null = null;
let cacheRefCount = 0;

function isBrowserWithIndexedDB(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    // Exclude jsdom/test environments where PGlite WASM cannot run
    navigator.userAgent.indexOf('jsdom') === -1
  );
}

async function getBrowserCache(): Promise<CacheStore | null> {
  if (browserCache) return browserCache;
  if (cacheInitPromise) return cacheInitPromise;
  if (!isBrowserWithIndexedDB()) return null;

  cacheInitPromise = (async () => {
    try {
      const { createOfflineCache } = await import('./browser-cache-factory.js');
      const cache = await createOfflineCache();
      browserCache = cache;
      return cache;
    } catch {
      return null;
    }
  })();

  return cacheInitPromise;
}

function releaseBrowserCache(): void {
  cacheRefCount--;
  if (cacheRefCount === 0 && browserCache) {
    browserCache.close().catch(() => {
      /* fire-and-forget cleanup */
    });
    browserCache = null;
    cacheInitPromise = null;
  }
}

/** Reset singleton state between tests. @internal */
export function _resetCacheState(): void {
  browserCache = null;
  cacheInitPromise = null;
  cacheRefCount = 0;
}

// ─── localStorage fallback (private browsing, PGlite unavailable) ────────────

interface CachedPayload<T> {
  data: T[];
  cachedAt: string;
}

const LS_PREFIX = 'revealui:cache:';

function readLocalStorageCache<T>(key: string, ttlSeconds: number): T[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!Array.isArray(parsed.data)) return null;
    const cachedTime = new Date(parsed.cachedAt).getTime();
    if (Number.isNaN(cachedTime)) return null;
    if ((Date.now() - cachedTime) / 1_000 > ttlSeconds) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalStorageCache<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedPayload<T> = { data, cachedAt: new Date().toISOString() };
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or private browsing.
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wrap an ElectricSQL `useShape` subscription with offline-first caching.
 *
 * When online the hook delegates to `useShape` and mirrors results into a
 * PGlite browser cache (IndexedDB). When offline (or during initial load) it
 * returns the most recent cached snapshot if one exists within the TTL window.
 *
 * Falls back to localStorage when PGlite is unavailable (e.g. private browsing
 * or environments without WASM support).
 *
 * @typeParam T - Row type returned by the shape subscription.
 */
export function useOfflineCache<T>(options: UseOfflineCacheOptions): UseOfflineCacheResult<T> {
  const { shapeUrl, cacheKey, ttlSeconds = DEFAULT_TTL_SECONDS, tags } = options;
  const { isOnline } = useOnlineStatus();

  const shape = useShape({ url: shapeUrl, fetchClient: fetchWithTimeout });

  // Read localStorage synchronously on first render for instant offline data
  const [cache, setCache] = useState<CacheStore | null>(browserCache);
  const [cachedData, setCachedData] = useState<T[] | null>(() =>
    readLocalStorageCache<T>(cacheKey, ttlSeconds),
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    // Recover lastSyncedAt from localStorage cache timestamp
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedPayload<T>;
      const time = new Date(parsed.cachedAt).getTime();
      return Number.isNaN(time) ? null : new Date(parsed.cachedAt);
    } catch {
      return null;
    }
  });
  const mounted = useRef(true);
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;
  const ttlSecondsRef = useRef(ttlSeconds);
  ttlSecondsRef.current = ttlSeconds;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  // Initialize PGlite browser cache
  useEffect(() => {
    mounted.current = true;
    cacheRefCount++;

    getBrowserCache()
      .then((c) => {
        if (!mounted.current) return null;
        if (c) {
          setCache(c);
          return c.get<T[]>(cacheKeyRef.current);
        }
        // PGlite unavailable; fall back to localStorage
        const lsData = readLocalStorageCache<T>(cacheKeyRef.current, ttlSecondsRef.current);
        if (lsData && mounted.current) setCachedData(lsData);
        return null;
      })
      .then((data) => {
        if (mounted.current && data) {
          setCachedData(data);
        }
      })
      .catch(() => {
        if (mounted.current) {
          // Fall back to localStorage
          const lsData = readLocalStorageCache<T>(cacheKeyRef.current, ttlSecondsRef.current);
          if (lsData) setCachedData(lsData);
        }
      });

    return () => {
      mounted.current = false;
      releaseBrowserCache();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist live data to PGlite (or localStorage fallback) when shape delivers fresh rows
  const shapeData = shape.data;
  useEffect(() => {
    if (!isOnline) return;
    if (!Array.isArray(shapeData) || shapeData.length === 0) return;

    const typed = toRecords<T>(shapeData);
    const allTags = [OFFLINE_CACHE_TAG, ...(tagsRef.current ?? [])];

    if (cache) {
      cache.set(cacheKeyRef.current, typed, ttlSecondsRef.current, allTags).catch(() => {
        // PGlite write failed; fall back to localStorage
        writeLocalStorageCache(cacheKeyRef.current, typed);
      });
    } else {
      writeLocalStorageCache(cacheKeyRef.current, typed);
    }

    if (mounted.current) {
      setCachedData(typed);
      setLastSyncedAt(new Date());
    }
  }, [shapeData, isOnline, cache]);

  // Manual invalidation
  const invalidate = useCallback(async () => {
    if (cache) {
      await cache.delete(cacheKeyRef.current);
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LS_PREFIX + cacheKeyRef.current);
      } catch {
        // Ignore
      }
    }
    if (mounted.current) {
      setCachedData(null);
      setLastSyncedAt(null);
    }
  }, [cache]);

  // Determine what to return
  if (isOnline && Array.isArray(shapeData) && shapeData.length > 0) {
    return {
      data: toRecords<T>(shapeData),
      isOnline,
      isSyncing: shape.isLoading,
      lastSyncedAt,
      error: shape.error || null,
      invalidate,
    };
  }

  // Offline or shape has not loaded yet: use cached data
  return {
    data: cachedData ?? [],
    isOnline,
    isSyncing: isOnline && shape.isLoading,
    lastSyncedAt,
    error: shape.error || null,
    invalidate,
  };
}
