/**
 * Local-evicting revalidation over CacheStore (GAP-194 3.7a).
 *
 * Companion to createCachedFunction. Multi-instance: also publish via
 * CacheInvalidationChannel after local delete.
 *
 * Next-only second arg to revalidateTag(tag, 'page') is dropped — no cache
 * profile analog. Path revalidation deletes entries tagged `path:<path>` and
 * keys with prefix `path:<path>`.
 */

import type { CacheStore } from './adapters/types.js';
import { getDefaultCacheStore } from './default-store.js';

/** Normalize path for tags/prefixes: leading slash, no trailing slash except root. */
export function normalizeCachePath(path: string): string {
  if (!path || path === '/') return '/';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

export function pathCacheTag(path: string): string {
  return `path:${normalizeCachePath(path)}`;
}

/**
 * Delete all store entries tagged with any of the given tags.
 * Returns number of entries removed from the local store.
 */
export async function revalidateTag(
  tag: string | readonly string[],
  store: CacheStore = getDefaultCacheStore(),
): Promise<number> {
  const tags = typeof tag === 'string' ? [tag] : [...tag];
  if (tags.length === 0) return 0;
  return store.deleteByTags(tags);
}

/**
 * Delete entries associated with a URL path (tag `path:…` + key prefix `path:…`).
 * Does not touch Next Full Route Cache — while admin remains Next, call
 * `next/cache` revalidatePath for HTML/RSC route cache separately.
 */
export async function revalidatePath(
  path: string,
  store: CacheStore = getDefaultCacheStore(),
): Promise<number> {
  const normalized = normalizeCachePath(path);
  const tag = pathCacheTag(normalized);
  const byTag = await store.deleteByTags([tag]);
  const byPrefix = await store.deleteByPrefix(`path:${normalized}`);
  // Overlap possible if same entry matched both; prefer sum of operations as
  // upper bound signal (tests assert >0 on known keys).
  return byTag + byPrefix;
}
