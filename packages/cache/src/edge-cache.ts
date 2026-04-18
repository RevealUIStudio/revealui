/**
 * Edge Caching and ISR (Incremental Static Regeneration)
 *
 * Utilities for Next.js edge caching, ISR, and on-demand revalidation
 */

import { getClientIp } from '@revealui/security';
import type { NextRequest, NextResponse } from 'next/server';
import { getCacheLogger } from './logger.js';

/**
 * Next.js extends the standard RequestInit with a `next` property
 * for ISR revalidation and cache tags.
 */
interface NextFetchRequestInit extends RequestInit {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

/**
 * ISR Configuration
 */
export interface ISRConfig {
  revalidate?: number | false;
  tags?: string[];
  dynamicParams?: boolean;
}

export const ISR_PRESETS = {
  // Revalidate every request
  always: {
    revalidate: 0,
  },

  // Revalidate every minute
  minute: {
    revalidate: 60,
  },

  // Revalidate every 5 minutes
  fiveMinutes: {
    revalidate: 300,
  },

  // Revalidate every hour
  hourly: {
    revalidate: 3600,
  },

  // Revalidate daily
  daily: {
    revalidate: 86400,
  },

  // Never revalidate (static)
  never: {
    revalidate: false,
  },
} as const;

/**
 * Generate static params for ISR
 */
export async function generateStaticParams<T>(
  fetchFn: () => Promise<T[]>,
  mapFn: (item: T) => Record<string, string>,
): Promise<Array<Record<string, string>>> {
  try {
    const items = await fetchFn();
    return items.map(mapFn);
  } catch (error) {
    getCacheLogger().error(
      'Failed to generate static params',
      error instanceof Error ? error : new Error(String(error)),
    );
    return [];
  }
}

/**
 * Revalidate tag
 */
export async function revalidateTag(
  tag: string,
  secret?: string,
): Promise<{ revalidated: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    getCacheLogger().warn('revalidateTag skipped: NEXT_PUBLIC_URL is not configured', { tag });
    return { revalidated: false, error: 'NEXT_PUBLIC_URL is not configured' };
  }

  try {
    const url = new URL('/api/revalidate', baseUrl);

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['x-revalidate-secret'] = secret;
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ tag }),
    });

    const data = await response.json();

    if (!response.ok) {
      getCacheLogger().warn('revalidateTag failed', {
        tag,
        status: response.status,
        error: data.error,
      });
    }

    return {
      revalidated: response.ok,
      error: data.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    getCacheLogger().warn('revalidateTag error', { tag, error: message });
    return {
      revalidated: false,
      error: message,
    };
  }
}

/**
 * Revalidate path
 */
export async function revalidatePath(
  path: string,
  secret?: string,
): Promise<{ revalidated: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    getCacheLogger().warn('revalidatePath skipped: NEXT_PUBLIC_URL is not configured', { path });
    return { revalidated: false, error: 'NEXT_PUBLIC_URL is not configured' };
  }

  try {
    const url = new URL('/api/revalidate', baseUrl);

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (secret) {
      headers['x-revalidate-secret'] = secret;
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ path }),
    });

    const data = await response.json();

    return {
      revalidated: response.ok,
      error: data.error,
    };
  } catch (error) {
    return {
      revalidated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revalidate multiple paths
 */
export async function revalidatePaths(
  paths: string[],
  secret?: string,
): Promise<{
  revalidated: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}> {
  const results = await Promise.allSettled(paths.map((path) => revalidatePath(path, secret)));

  let revalidated = 0;
  let failed = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const path = paths[i];

    if (!(result && path)) {
      continue;
    }

    if (result.status === 'fulfilled' && result.value.revalidated) {
      revalidated++;
    } else {
      failed++;
      const error =
        result.status === 'fulfilled'
          ? result.value.error || 'Unknown error'
          : String(result.reason) || 'Unknown error';

      errors.push({ path, error });
    }
  }

  return { revalidated, failed, errors };
}

/**
 * Revalidate multiple tags
 */
export async function revalidateTags(
  tags: string[],
  secret?: string,
): Promise<{
  revalidated: number;
  failed: number;
  errors: Array<{ tag: string; error: string }>;
}> {
  const results = await Promise.allSettled(tags.map((tag) => revalidateTag(tag, secret)));

  let revalidated = 0;
  let failed = 0;
  const errors: Array<{ tag: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const tag = tags[i];

    if (!(result && tag)) {
      continue;
    }

    if (result.status === 'fulfilled' && result.value.revalidated) {
      revalidated++;
    } else {
      failed++;
      const error =
        result.status === 'fulfilled'
          ? result.value.error || 'Unknown error'
          : String(result.reason) || 'Unknown error';

      errors.push({ tag, error });
    }
  }

  return { revalidated, failed, errors };
}

/**
 * Edge middleware cache configuration
 */
export interface EdgeCacheConfig {
  cache?: 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached';
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

/**
 * Create edge cached fetch
 */
export function createEdgeCachedFetch(config: EdgeCacheConfig = {}) {
  return async <T>(url: string, options?: NextFetchRequestInit): Promise<T> => {
    const fetchOptions: NextFetchRequestInit = {
      ...options,
      ...config,
      next: {
        ...options?.next,
        ...config.next,
      },
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.statusText}`);
    }

    return response.json();
  };
}

/**
 * Unstable cache wrapper (Next.js 14+)
 */
export function createCachedFunction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: {
    tags?: string[];
    revalidate?: number | false;
  } = {},
): (...args: TArgs) => Promise<TReturn> {
  // If revalidation is disabled, bypass cache entirely
  if (options.revalidate === false) {
    return fn;
  }

  const ttlMs = (options.revalidate ?? 60) * 1000;
  const cache = new Map<string, { value: TReturn; expiresAt: number }>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && now < cached.expiresAt) {
      return cached.value;
    }

    const value = await fn(...args);
    cache.set(key, { value, expiresAt: now + ttlMs });
    return value;
  };
}

/**
 * Edge rate limiting with cache
 */
export interface EdgeRateLimitConfig {
  limit: number;
  window: number;
  key?: (request: NextRequest) => string;
}

export class EdgeRateLimiter {
  private cache: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(private config: EdgeRateLimitConfig) {}

  /**
   * Check rate limit
   */
  check(request: NextRequest): {
    allowed: boolean;
    limit: number;
    remaining: number;
    reset: number;
  } {
    const key = this.config.key ? this.config.key(request) : getClientIp(request);

    const now = Date.now();
    let entry = this.cache.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.window,
      };
      this.cache.set(key, entry);
    }

    // Increment count
    entry.count++;

    const allowed = entry.count <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - entry.count);

    return {
      allowed,
      limit: this.config.limit,
      remaining,
      reset: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Edge geolocation caching
 */
export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export function getGeoLocation(request: NextRequest): GeoLocation | null {
  // Vercel edge headers
  const country = request.headers.get('x-vercel-ip-country');
  const region = request.headers.get('x-vercel-ip-country-region');
  const city = request.headers.get('x-vercel-ip-city');
  const latitude = request.headers.get('x-vercel-ip-latitude');
  const longitude = request.headers.get('x-vercel-ip-longitude');

  if (!country) {
    // Cloudflare headers
    const cfCountry = request.headers.get('cf-ipcountry');
    if (cfCountry) {
      return {
        country: cfCountry,
      };
    }

    return null;
  }

  return {
    country: country || undefined,
    region: region || undefined,
    city: city ? decodeURIComponent(city) : undefined,
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,
  };
}

/**
 * Edge A/B testing with cache
 */
export function getABTestVariant(
  request: NextRequest,
  testName: string,
  variants: string[],
): string {
  // Check cookie first
  const cookieName = `ab-test-${testName}`;
  const cookieVariant = request.cookies.get(cookieName)?.value;

  if (cookieVariant && variants.includes(cookieVariant)) {
    return cookieVariant;
  }

  // Assign variant based on IP hash
  const ip = getClientIp(request);
  const hash = simpleHash(ip + testName);
  const variantIndex = hash % variants.length;
  const variant = variants[variantIndex];

  if (!variant) {
    throw new Error('No variant found for A/B test');
  }

  return variant;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Edge personalization cache
 */
export interface PersonalizationConfig {
  userId?: string;
  preferences?: Record<string, unknown>;
  location?: GeoLocation;
  device?: 'mobile' | 'tablet' | 'desktop';
  variant?: string;
}

export function getPersonalizationConfig(request: NextRequest): PersonalizationConfig {
  const userAgent = request.headers.get('user-agent') || '';
  const device = getDeviceType(userAgent);
  const location = getGeoLocation(request);

  return {
    userId: request.cookies.get('user-id')?.value,
    location: location || undefined,
    device,
  };
}

/**
 * Detect device type
 */
function getDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase();
  const isTablet = ua.includes('tablet') || ua.includes('ipad');
  if (isTablet) return 'tablet';
  if (ua.includes('mobile')) return 'mobile';
  return 'desktop';
}

/**
 * Edge cache headers helper
 */
export function setEdgeCacheHeaders(
  response: NextResponse,
  config: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    tags?: string[];
  },
): NextResponse {
  const cacheControl: string[] = [];

  if (config.maxAge !== undefined) {
    cacheControl.push(`max-age=${config.maxAge}`);
  }

  if (config.sMaxAge !== undefined) {
    cacheControl.push(`s-maxage=${config.sMaxAge}`);
  }

  if (config.staleWhileRevalidate !== undefined) {
    cacheControl.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (cacheControl.length > 0) {
    response.headers.set('Cache-Control', cacheControl.join(', '));
  }

  if (config.tags && config.tags.length > 0) {
    response.headers.set('Cache-Tag', config.tags.join(','));
  }

  return response;
}

/**
 * Preload links for critical resources
 */
export function addPreloadLinks(
  response: NextResponse,
  resources: Array<{
    href: string;
    as: string;
    type?: string;
    crossorigin?: boolean;
  }>,
): NextResponse {
  const links = resources.map((resource) => {
    const attrs = [`<${resource.href}>`, `rel="preload"`, `as="${resource.as}"`];

    if (resource.type) {
      attrs.push(`type="${resource.type}"`);
    }

    if (resource.crossorigin) {
      attrs.push('crossorigin');
    }

    return attrs.join('; ');
  });

  if (links.length > 0) {
    response.headers.set('Link', links.join(', '));
  }

  return response;
}

/**
 * Cache warming for ISR pages
 */
export async function warmISRCache(
  paths: string[],
  baseURL: string = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
): Promise<{
  warmed: number;
  failed: number;
  errors: Array<{ path: string; error: string }>;
}> {
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = new URL(path, baseURL);
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return true;
    }),
  );

  let warmed = 0;
  let failed = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const path = paths[i];

    if (!(result && path)) {
      continue;
    }

    if (result.status === 'fulfilled') {
      warmed++;
    } else {
      failed++;
      errors.push({
        path,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason) || 'Unknown error',
      });
    }
  }

  return { warmed, failed, errors };
}
