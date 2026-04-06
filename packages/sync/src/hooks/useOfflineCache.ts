'use client';

import { useShape } from '@electric-sql/react';
import { useEffect, useRef, useState } from 'react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { toRecords } from '../shape-utils.js';
import { useOnlineStatus } from './useOnlineStatus.js';

/** Prefix for all offline-cache localStorage keys. */
const CACHE_PREFIX = 'revealui:cache:';

/** Default time-to-live for cached data (seconds). */
const DEFAULT_TTL_SECONDS = 3600;

interface CachedPayload<T> {
  data: T[];
  cachedAt: string;
}

interface UseOfflineCacheOptions {
  /** ElectricSQL shape subscription URL. */
  shapeUrl: string;
  /** Unique key for the localStorage cache entry. */
  cacheKey: string;
  /** How long cached data is considered fresh (seconds). Defaults to 3600. */
  ttlSeconds?: number;
}

interface UseOfflineCacheResult<T> {
  /** The current data — live from the shape when online, cached when offline. */
  data: T[];
  /** Whether the browser has network connectivity. */
  isOnline: boolean;
  /** Whether the shape subscription is currently loading fresh data. */
  isSyncing: boolean;
  /** Timestamp of the most recent successful sync to cache. */
  lastSyncedAt: Date | null;
  /** Shape subscription or cache-read error, if any. */
  error: Error | null;
}

/**
 * Check whether `localStorage` is usable.
 */
function hasLocalStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const testKey = '__revealui_oc_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read cached data from localStorage. Returns `null` when the entry is
 * missing, expired, or unreadable.
 */
function readCache<T>(cacheKey: string, ttlSeconds: number): CachedPayload<T> | null {
  if (!hasLocalStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!Array.isArray(parsed.data)) {
      return null;
    }
    // Check TTL.
    const cachedTime = new Date(parsed.cachedAt).getTime();
    if (Number.isNaN(cachedTime)) {
      return null;
    }
    const ageSeconds = (Date.now() - cachedTime) / 1_000;
    if (ageSeconds > ttlSeconds) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write data to the localStorage cache. Silently ignores failures.
 */
function writeCache<T>(cacheKey: string, data: T[]): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    const payload: CachedPayload<T> = {
      data,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(payload));
  } catch {
    // Quota exceeded or private browsing — drop silently.
  }
}

/**
 * Wrap an ElectricSQL `useShape` subscription with offline-first caching.
 *
 * When online the hook delegates to `useShape` and mirrors results into
 * `localStorage`. When offline (or during initial load) it returns the
 * most recent cached snapshot if one exists within the TTL window.
 *
 * @typeParam T - Row type returned by the shape subscription.
 */
export function useOfflineCache<T>(options: UseOfflineCacheOptions): UseOfflineCacheResult<T> {
  const { shapeUrl, cacheKey, ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const { isOnline } = useOnlineStatus();

  // Shape subscription — runs continuously; ElectricSQL handles reconnection.
  const shape = useShape({ url: shapeUrl, fetchClient: fetchWithTimeout });

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Keep a ref to avoid stale closures in the sync effect.
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  // Persist live data to cache whenever the shape delivers fresh rows.
  const shapeData = shape.data;
  useEffect(() => {
    if (!isOnline) {
      return;
    }
    if (!Array.isArray(shapeData) || shapeData.length === 0) {
      return;
    }
    const typed = toRecords<T>(shapeData);
    writeCache(cacheKeyRef.current, typed);
    setLastSyncedAt(new Date());
  }, [shapeData, isOnline]);

  // Determine what to return.
  if (isOnline && Array.isArray(shapeData) && shapeData.length > 0) {
    return {
      data: toRecords<T>(shapeData),
      isOnline,
      isSyncing: shape.isLoading,
      lastSyncedAt,
      error: shape.error || null,
    };
  }

  // Offline or shape has not loaded yet — try the cache.
  const cached = readCache<T>(cacheKey, ttlSeconds);
  const cachedSyncDate = cached !== null ? new Date(cached.cachedAt) : null;

  return {
    data: cached?.data ?? [],
    isOnline,
    isSyncing: isOnline && shape.isLoading,
    lastSyncedAt: lastSyncedAt ?? cachedSyncDate,
    error: shape.error || null,
  };
}
