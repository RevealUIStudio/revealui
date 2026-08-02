/**
 * Process-default CacheStore for createCachedFunction / revalidate*.
 *
 * Single-instance by default (InMemory). Multi-instance deploys should call
 * `setDefaultCacheStore` with a shared-backed store (e.g. PGlite) and wire
 * CacheInvalidationChannel for cross-process busts.
 */

import { InMemoryCacheStore } from './adapters/memory.js';
import type { CacheStore } from './adapters/types.js';

let defaultStore: CacheStore | null = null;

/** Returns the process default store, creating an in-memory store on first use. */
export function getDefaultCacheStore(): CacheStore {
  if (!defaultStore) {
    defaultStore = new InMemoryCacheStore();
  }
  return defaultStore;
}

/**
 * Replace the process default store (tests, multi-instance boot).
 * Callers own lifecycle of the previous store (close if needed).
 */
export function setDefaultCacheStore(store: CacheStore): void {
  defaultStore = store;
}

/** Reset to a fresh in-memory store. Test helper; also used after close. */
export function resetDefaultCacheStore(): void {
  defaultStore = new InMemoryCacheStore();
}
