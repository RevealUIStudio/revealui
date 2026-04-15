/**
 * API Response Caching Layer
 *
 * Implements HTTP caching for API responses
 */

import { logger } from '../observability/logger.js';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  staleWhileRevalidate?: number; // SWR time in seconds
  tags?: string[]; // Cache tags for invalidation
  vary?: string[]; // Vary headers
  private?: boolean; // Cache-Control: private vs public
  noStore?: boolean; // Disable caching
}

interface CacheEntry {
  response: {
    body: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
  timestamp: number;
  ttl: number;
  tags: string[];
}

// In-memory cache store (no external cache dependency needed)
const cacheStore = new Map<string, CacheEntry>();

/**
 * Generate cache key from request
 */
export function generateCacheKey(request: Request): string {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const query = url.searchParams.toString();

  // Include authorization in key for private caches
  const auth = request.headers.get('authorization') || '';
  const authHash = auth ? btoa(auth).substring(0, 8) : '';

  return `${method}:${path}${query ? `?${query}` : ''}${authHash ? `:${authHash}` : ''}`;
}

/**
 * Check if response is cacheable
 */
function isCacheable(request: Request, response: Response): boolean {
  // Only cache GET and HEAD requests
  if (!['GET', 'HEAD'].includes(request.method)) {
    return false;
  }

  // Don't cache error responses
  if (response.status >= 400) {
    return false;
  }

  // Check for Cache-Control: no-store
  const cacheControl = response.headers.get('cache-control') || '';
  if (cacheControl.includes('no-store') || cacheControl.includes('no-cache')) {
    return false;
  }

  return true;
}

/**
 * Get cached response
 */
export async function getCachedResponse(request: Request): Promise<Response | null> {
  const key = generateCacheKey(request);
  const entry = cacheStore.get(key);

  if (!entry) {
    return null;
  }

  const age = Math.floor((Date.now() - entry.timestamp) / 1000);

  // Check if expired
  if (age > entry.ttl) {
    cacheStore.delete(key);
    return null;
  }

  // Create response from cache
  const headers = new Headers(entry.response.headers);
  headers.set('X-Cache', 'HIT');
  headers.set('Age', age.toString());

  return new Response(entry.response.body, {
    status: entry.response.status,
    statusText: entry.response.statusText,
    headers,
  });
}

/**
 * Set cached response
 */
export async function setCachedResponse(
  request: Request,
  response: Response,
  options: CacheOptions = {},
): Promise<void> {
  const key = generateCacheKey(request);

  // Don't cache if not cacheable
  if (!isCacheable(request, response)) {
    return;
  }

  // Get response body
  const body = await response.clone().text();

  // Create cache entry
  const entry: CacheEntry = {
    response: {
      body,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    },
    timestamp: Date.now(),
    ttl: options.ttl || 300, // 5 minutes default
    tags: options.tags || [],
  };

  cacheStore.set(key, entry);
}

/**
 * Invalidate cache by key
 */
export function invalidateCacheKey(key: string): void {
  cacheStore.delete(key);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): number {
  let count = 0;
  // Escape all regex special characters, then convert glob wildcards (*) to .*
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replaceAll('\\*', '.*')}$`);

  for (const key of cacheStore.keys()) {
    if (regex.test(key)) {
      cacheStore.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Invalidate cache by tags
 */
export function invalidateCacheTags(tags: string[]): number {
  let count = 0;

  for (const [key, entry] of cacheStore.entries()) {
    if (entry.tags.some((tag) => tags.includes(tag))) {
      cacheStore.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cacheStore.clear();
}

/**
 * Set Cache-Control headers
 */
export function setCacheHeaders(response: Response, options: CacheOptions): Response {
  const { ttl = 300, staleWhileRevalidate, private: isPrivate, noStore } = options;

  if (noStore) {
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const directives: string[] = [];

  // Public or private
  directives.push(isPrivate ? 'private' : 'public');

  // Max age
  directives.push(`max-age=${ttl}`);

  // Stale while revalidate
  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  // Vary headers
  if (options.vary) {
    response.headers.set('Vary', options.vary.join(', '));
  }

  response.headers.set('Cache-Control', directives.join(', '));

  return response;
}

/**
 * Create caching middleware
 */
export function createCacheMiddleware(options: CacheOptions = {}) {
  return async (request: Request, next: () => Promise<Response>) => {
    // Try to get from cache
    const cached = await getCachedResponse(request);
    if (cached) {
      return cached;
    }

    // Get fresh response
    const response = await next();

    // Set cache headers
    setCacheHeaders(response, options);

    // Cache response
    await setCachedResponse(request, response, options);

    // Set X-Cache: MISS header
    response.headers.set('X-Cache', 'MISS');

    return response;
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let totalSize = 0;
  let expired = 0;
  let valid = 0;

  for (const entry of cacheStore.values()) {
    const age = Math.floor((now - entry.timestamp) / 1000);
    const size = new Blob([entry.response.body]).size;

    totalSize += size;

    if (age > entry.ttl) {
      expired++;
    } else {
      valid++;
    }
  }

  return {
    totalEntries: cacheStore.size,
    validEntries: valid,
    expiredEntries: expired,
    totalSize,
    averageSize: cacheStore.size > 0 ? totalSize / cacheStore.size : 0,
  };
}

/**
 * Purge expired entries
 */
export function purgeExpiredCache(): number {
  const now = Date.now();
  let purged = 0;

  for (const [key, entry] of cacheStore.entries()) {
    const age = Math.floor((now - entry.timestamp) / 1000);

    if (age > entry.ttl) {
      cacheStore.delete(key);
      purged++;
    }
  }

  return purged;
}

/**
 * Start cache cleanup interval
 */
export function startCacheCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const purged = purgeExpiredCache();
    if (purged > 0) {
      logger.info('Purged expired cache entries', { count: purged });
    }
  }, intervalMs);
}

/**
 * Cache response with ETag
 */
export function withETag(response: Response, content: string): Response {
  // Generate ETag from content hash
  const hash = btoa(content).substring(0, 16);
  const etag = `"${hash}"`;

  response.headers.set('ETag', etag);

  return response;
}

/**
 * Check if request has matching ETag
 */
export function checkETag(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Create 304 Not Modified response
 */
export function createNotModifiedResponse(): Response {
  return new Response(null, {
    status: 304,
    statusText: 'Not Modified',
  });
}

/**
 * Cache presets for common scenarios
 */
export const CACHE_PRESETS = {
  // Never cache
  noCache: {
    noStore: true,
  },

  // Short cache (1 minute)
  short: {
    ttl: 60,
    staleWhileRevalidate: 30,
  },

  // Medium cache (5 minutes)
  medium: {
    ttl: 300,
    staleWhileRevalidate: 60,
  },

  // Long cache (1 hour)
  long: {
    ttl: 3600,
    staleWhileRevalidate: 300,
  },

  // Very long cache (1 day)
  veryLong: {
    ttl: 86400,
    staleWhileRevalidate: 3600,
  },

  // Immutable (1 year)
  immutable: {
    ttl: 31536000,
    private: false,
  },

  // Private user data
  private: {
    ttl: 300,
    private: true,
  },

  // Public static data
  public: {
    ttl: 3600,
    private: false,
  },
} as const;

/**
 * Cache API response
 */
export async function cacheAPIResponse<T>(
  key: string,
  responseFn: () => Promise<T>,
  options: CacheOptions = {},
): Promise<{ data: T; cached: boolean }> {
  const cacheKey = `api:${key}`;
  const entry = cacheStore.get(cacheKey);

  // Check cache
  if (entry) {
    const age = Math.floor((Date.now() - entry.timestamp) / 1000);

    if (age <= entry.ttl) {
      return {
        data: JSON.parse(entry.response.body),
        cached: true,
      };
    }
  }

  // Get fresh data
  const data = await responseFn();

  // Cache it
  const cacheEntry: CacheEntry = {
    response: {
      body: JSON.stringify(data),
      status: 200,
      statusText: 'OK',
      headers: {},
    },
    timestamp: Date.now(),
    ttl: options.ttl || 300,
    tags: options.tags || [],
  };

  cacheStore.set(cacheKey, cacheEntry);

  return {
    data,
    cached: false,
  };
}
