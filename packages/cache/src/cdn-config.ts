/**
 * CDN Configuration and Cache Management
 *
 * Utilities for CDN caching, edge caching, and cache invalidation
 */

/**
 * CDN Cache Configuration
 */
export interface CDNCacheConfig {
  provider?: 'cloudflare' | 'vercel' | 'fastly' | 'custom';
  zones?: string[];
  ttl?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  bypassCache?: boolean;
  cacheKey?: string[];
  varyHeaders?: string[];
}

export const DEFAULT_CDN_CONFIG: CDNCacheConfig = {
  provider: 'vercel',
  ttl: 31536000, // 1 year for static assets
  staleWhileRevalidate: 86400, // 1 day
  staleIfError: 604800, // 1 week
  bypassCache: false,
  cacheKey: ['url', 'headers.accept', 'headers.accept-encoding'],
  varyHeaders: ['Accept', 'Accept-Encoding'],
};

/**
 * Generate Cache-Control header
 */
export function generateCacheControl(config: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  public?: boolean;
  private?: boolean;
  immutable?: boolean;
  noCache?: boolean;
  noStore?: boolean;
}): string {
  const directives: string[] = [];

  // Visibility
  if (config.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (config.noCache) {
    directives.push('no-cache');
    return directives.join(', ');
  }

  if (config.public) {
    directives.push('public');
  } else if (config.private) {
    directives.push('private');
  }

  // Max age
  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }

  // Shared max age (CDN)
  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  // Stale-while-revalidate
  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  // Stale-if-error
  if (config.staleIfError !== undefined) {
    directives.push(`stale-if-error=${config.staleIfError}`);
  }

  // Immutable
  if (config.immutable) {
    directives.push('immutable');
  }

  return directives.join(', ');
}

/**
 * Cache presets for different asset types
 */
export const CDN_CACHE_PRESETS = {
  // Static assets with hashed filenames (immutable)
  immutable: {
    maxAge: 31536000, // 1 year
    sMaxAge: 31536000,
    public: true,
    immutable: true,
  },

  // Static assets (images, fonts)
  static: {
    maxAge: 2592000, // 30 days
    sMaxAge: 31536000, // 1 year on CDN
    staleWhileRevalidate: 86400, // 1 day
    public: true,
  },

  // API responses (short-lived)
  api: {
    maxAge: 0,
    sMaxAge: 60, // 1 minute on CDN
    staleWhileRevalidate: 30,
    public: true,
  },

  // HTML pages (dynamic)
  page: {
    maxAge: 0,
    sMaxAge: 300, // 5 minutes on CDN
    staleWhileRevalidate: 60,
    public: true,
  },

  // User-specific data
  private: {
    maxAge: 300, // 5 minutes
    private: true,
    staleWhileRevalidate: 60,
  },

  // No caching
  noCache: {
    noStore: true,
  },

  // Revalidate every request
  revalidate: {
    maxAge: 0,
    sMaxAge: 0,
    noCache: true,
  },
} as const;

/**
 * CDN Purge Configuration
 */
export interface CDNPurgeConfig {
  provider: 'cloudflare' | 'vercel' | 'fastly';
  apiKey?: string;
  apiSecret?: string;
  zoneId?: string;
  distributionId?: string;
}

/**
 * Purge CDN cache
 */
export async function purgeCDNCache(
  urls: string[],
  config: CDNPurgeConfig,
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
  const { provider } = config;

  switch (provider) {
    case 'cloudflare':
      return purgeCloudflare(urls, config);
    case 'vercel':
      return purgeVercel(urls, config);
    case 'fastly':
      return purgeFastly(urls, config);
    default:
      throw new Error(`Unsupported CDN provider: ${provider}`);
  }
}

/**
 * Purge Cloudflare cache
 */
async function purgeCloudflare(
  urls: string[],
  config: CDNPurgeConfig,
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
  const { apiKey, zoneId } = config;

  if (!(apiKey && zoneId)) {
    throw new Error('Cloudflare API key and zone ID required');
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      },
    );

    const data = await response.json();

    return {
      success: data.success,
      purged: urls.length,
      errors: data.errors,
    };
  } catch (error) {
    return {
      success: false,
      purged: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Purge Vercel cache
 */
async function purgeVercel(
  urls: string[],
  config: CDNPurgeConfig,
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
  const { apiKey } = config;

  if (!apiKey) {
    throw new Error('Vercel API token required');
  }

  try {
    const response = await fetch('https://api.vercel.com/v1/purge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      purged: urls.length,
      errors: data.error ? [data.error.message] : undefined,
    };
  } catch (error) {
    return {
      success: false,
      purged: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Purge Fastly cache
 */
async function purgeFastly(
  urls: string[],
  config: CDNPurgeConfig,
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
  const { apiKey } = config;

  if (!apiKey) {
    throw new Error('Fastly API key required');
  }

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, {
          method: 'PURGE',
          headers: {
            'Fastly-Key': apiKey,
          },
        });

        return response.ok;
      }),
    );

    const purged = results.filter(Boolean).length;

    return {
      success: purged === urls.length,
      purged,
    };
  } catch (error) {
    return {
      success: false,
      purged: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Purge by cache tag
 */
export async function purgeCacheByTag(
  tags: string[],
  config: CDNPurgeConfig,
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
  const { provider, apiKey, zoneId } = config;

  if (provider === 'cloudflare') {
    if (!(apiKey && zoneId)) {
      throw new Error('Cloudflare API key and zone ID required');
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tags }),
        },
      );

      const data = await response.json();

      return {
        success: data.success,
        purged: tags.length,
        errors: data.errors,
      };
    } catch (error) {
      return {
        success: false,
        purged: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  throw new Error(`Cache tag purging not supported for ${provider}`);
}

/**
 * Purge everything
 */
export async function purgeAllCache(
  config: CDNPurgeConfig,
): Promise<{ success: boolean; errors?: string[] }> {
  const { provider, apiKey, zoneId } = config;

  if (provider === 'cloudflare') {
    if (!(apiKey && zoneId)) {
      throw new Error('Cloudflare API key and zone ID required');
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ purge_everything: true }),
        },
      );

      const data = await response.json();

      return {
        success: data.success,
        errors: data.errors,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  throw new Error(`Purge all not supported for ${provider}`);
}

/**
 * CDN cache warming
 */
export async function warmCDNCache(
  urls: string[],
  options: {
    concurrency?: number;
    headers?: Record<string, string>;
  } = {},
): Promise<{ warmed: number; failed: number; errors: string[] }> {
  const { concurrency = 5, headers = {} } = options;

  const results: { success: boolean; error?: string }[] = [];
  const chunks: string[][] = [];

  // Split into chunks
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  // Warm cache in chunks
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (url) => {
        try {
          const response = await fetch(url, { headers });
          return {
            success: response.ok,
            error: response.ok ? undefined : `${response.status} ${response.statusText}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    results.push(...chunkResults);
  }

  const warmed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const errors = results.flatMap((r) => (r.error ? [r.error] : []));

  return { warmed, failed, errors };
}

/**
 * Generate cache tags
 */
export function generateCacheTags(resource: {
  type: string;
  id?: string | number;
  related?: string[];
}): string[] {
  const tags: string[] = [];

  // Type tag
  tags.push(resource.type);

  // ID tag
  if (resource.id) {
    tags.push(`${resource.type}:${resource.id}`);
  }

  // Related tags
  if (resource.related) {
    tags.push(...resource.related);
  }

  return tags;
}

/**
 * Edge cache configuration for Vercel
 */
export function generateVercelCacheConfig(preset: keyof typeof CDN_CACHE_PRESETS) {
  const config = CDN_CACHE_PRESETS[preset];
  const cacheControl = generateCacheControl(config);

  return {
    headers: {
      'Cache-Control': cacheControl,
      'CDN-Cache-Control': cacheControl,
      'Vercel-CDN-Cache-Control': cacheControl,
    },
  };
}

/**
 * Edge cache configuration for Cloudflare
 */
export function generateCloudflareConfig(
  preset: keyof typeof CDN_CACHE_PRESETS,
  options: {
    cacheTags?: string[];
    bypassOnCookie?: string;
  } = {},
) {
  const config = CDN_CACHE_PRESETS[preset];
  const cacheControl = generateCacheControl(config);

  const headers: Record<string, string> = {
    'Cache-Control': cacheControl,
  };

  // Cache tags
  if (options.cacheTags && options.cacheTags.length > 0) {
    headers['Cache-Tag'] = options.cacheTags.join(',');
  }

  // Bypass on cookie
  if (options.bypassOnCookie) {
    headers['Cache-Control'] = `${cacheControl}, bypass=${options.bypassOnCookie}`;
  }

  return { headers };
}

/**
 * Check if response should be cached
 */
export function shouldCacheResponse(status: number, headers: Headers): boolean {
  // Don't cache errors
  if (status >= 400) {
    return false;
  }

  // Check Cache-Control header
  const cacheControl = headers.get('cache-control') || '';
  if (
    cacheControl.includes('no-store') ||
    cacheControl.includes('no-cache') ||
    cacheControl.includes('private')
  ) {
    return false;
  }

  return true;
}

/**
 * Calculate cache TTL from headers
 */
export function getCacheTTL(headers: Headers): number {
  const cacheControl = headers.get('cache-control') || '';

  // Check s-maxage first (CDN), then max-age
  for (const directive of cacheControl.split(',')) {
    const trimmed = directive.trim();
    if (trimmed.startsWith('s-maxage=')) {
      const val = trimmed.slice('s-maxage='.length);
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num)) return num;
    }
  }
  for (const directive of cacheControl.split(',')) {
    const trimmed = directive.trim();
    if (trimmed.startsWith('max-age=')) {
      const val = trimmed.slice('max-age='.length);
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num)) return num;
    }
  }

  // Check Expires header
  const expires = headers.get('expires');
  if (expires) {
    const expiresDate = new Date(expires);
    const now = new Date();
    return Math.max(0, Math.floor((expiresDate.getTime() - now.getTime()) / 1000));
  }

  return 0;
}
