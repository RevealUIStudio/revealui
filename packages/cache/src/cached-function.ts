/**
 * Tag-aware memoization over CacheStore (GAP-194 Phase 3 Tier 0 step 3.7a).
 *
 * Replaces Next `unstable_cache` for CMS data: explicit key-parts avoid
 * cross-function collisions; tags feed revalidateTag → deleteByTags.
 *
 * Do not use this for router RSC payloads (ADR D4: router stays uncached).
 */

import type { CacheStore } from './adapters/types.js';
import { getDefaultCacheStore } from './default-store.js';

const KEY_NAMESPACE = 'cf';

export interface CreateCachedFunctionOptions {
  /**
   * Explicit key parts (like `unstable_cache` key array). Required so two
   * zero-arg caches never collide on `[]`.
   */
  keyParts: readonly string[];
  /** Tags for revalidateTag / deleteByTags. */
  tags?: readonly string[];
  /** TTL in seconds (default 3600). */
  ttlSeconds?: number;
  /** Store override; defaults to process getDefaultCacheStore(). */
  store?: CacheStore;
}

function encodeKeyParts(keyParts: readonly string[]): string {
  if (keyParts.length === 0) {
    throw new Error('createCachedFunction: keyParts must be a non-empty array');
  }
  return keyParts.map((part) => encodeURIComponent(part)).join('|');
}

/**
 * Stable key segment for call args. Objects get sorted JSON; avoids Map
 * iteration order surprises for plain records.
 */
export function serializeCacheArgs(args: readonly unknown[]): string {
  if (args.length === 0) return '';
  return args.map((arg) => stableStringify(arg)).join('&');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

/** Build the store key for a cached function invocation. */
export function buildCachedFunctionKey(
  keyParts: readonly string[],
  args: readonly unknown[] = [],
): string {
  const base = `${KEY_NAMESPACE}:${encodeKeyParts(keyParts)}`;
  const argSeg = serializeCacheArgs(args);
  return argSeg ? `${base}:${argSeg}` : base;
}

/**
 * Wrap an async function with CacheStore memoization.
 *
 * @example
 * ```ts
 * const getGlobal = createCachedFunction(
 *   async (slug: string) => fetchGlobal(slug),
 *   { keyParts: ['global'], tags: ['globals'], ttlSeconds: 300 },
 * );
 * // Prefer binding tags per-call via keyParts when tags depend on args:
 * const load = (slug: string) =>
 *   createCachedFunction(async () => fetchGlobal(slug), {
 *     keyParts: ['global', slug],
 *     tags: [`global_${slug}`],
 *   })();
 * ```
 */
export function createCachedFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CreateCachedFunctionOptions,
): (...args: TArgs) => Promise<TResult> {
  const store = options.store ?? getDefaultCacheStore();
  const ttlSeconds = options.ttlSeconds ?? 3600;
  const tags = options.tags ? [...options.tags] : [];
  const keyParts = options.keyParts;

  // Validate early (empty keyParts)
  encodeKeyParts(keyParts);

  return async (...args: TArgs): Promise<TResult> => {
    const key = buildCachedFunctionKey(keyParts, args);
    const hit = await store.get<TResult>(key);
    if (hit !== null) {
      return hit;
    }
    const value = await fn(...args);
    await store.set(key, value, ttlSeconds, tags);
    return value;
  };
}
