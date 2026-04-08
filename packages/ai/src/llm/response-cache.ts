/**
 * Response Cache for LLM Providers
 *
 * Application-level caching for LLM responses. Works with any provider.
 * Provides 100% cost savings on cache hits vs Anthropic's 90% token-level savings.
 *
 * Use cases:
 * - Vultr (doesn't have prompt caching)
 * - OpenAI (doesn't have prompt caching)
 * - Any provider without built-in caching
 * - Supplement to Anthropic prompt caching for exact duplicates
 *
 * Features:
 * - LRU eviction policy
 * - Configurable TTL (default: 5 minutes)
 * - SHA-256 based cache keys
 * - Hit/miss statistics
 * - Memory-efficient storage
 */

import { createHash } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import type { Message, ToolCall, ToolDefinition } from './providers/base.js';

export interface CachedResponse {
  content: string;
  role: 'assistant';
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
  timestamp: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ResponseCacheOptions {
  /** Maximum number of cached responses (default: 1000) */
  max?: number;
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Enable cache statistics tracking (default: true) */
  enableStats?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  size: number;
}

/**
 * Response cache for LLM completions
 *
 * @example
 * ```typescript
 * const cache = new ResponseCache({ max: 1000, ttl: 5 * 60 * 1000 })
 *
 * const key = cache.getCacheKey(messages, options)
 * const cached = cache.get(key)
 *
 * if (cached) {
 *   return { ...cached, cached: true }
 * }
 *
 * const response = await llm.chat(messages, options)
 * cache.set(key, response)
 * ```
 */
export class ResponseCache {
  private cache: LRUCache<string, CachedResponse>;
  private stats: { hits: number; misses: number; evictions: number };
  private enableStats: boolean;

  constructor(options: ResponseCacheOptions = {}) {
    this.enableStats = options.enableStats ?? true;

    this.cache = new LRUCache({
      max: options.max ?? 1000,
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: true, // Reset TTL on access
      dispose: () => {
        if (this.enableStats) {
          this.stats.evictions++;
        }
      },
    });

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Generate cache key from messages and options
   *
   * Uses SHA-256 hash of JSON-serialized payload for:
   * - Consistent key generation
   * - Fixed-length keys (64 chars)
   * - Security (prevents key enumeration)
   */
  getCacheKey(
    messages: Message[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: ToolDefinition[];
      model?: string;
    },
  ): string {
    // Normalize messages (remove non-deterministic fields)
    const normalizedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      toolCallId: msg.toolCallId,
    }));

    const payload = {
      messages: normalizedMessages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      tools: options?.tools,
      model: options?.model,
    };

    const json = JSON.stringify(payload);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Get cached response
   *
   * @returns Cached response or undefined if not found/expired
   */
  get(key: string): CachedResponse | undefined {
    const cached = this.cache.get(key);

    if (cached) {
      if (this.enableStats) {
        this.stats.hits++;
      }
      return cached;
    }

    if (this.enableStats) {
      this.stats.misses++;
    }

    return undefined;
  }

  /**
   * Store response in cache
   */
  set(key: string, response: CachedResponse): void {
    // Ensure timestamp is set
    if (!response.timestamp) {
      response.timestamp = Date.now();
    }

    this.cache.set(key, response);
  }

  /**
   * Check if key exists in cache (without updating stats)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached responses
   */
  clear(): void {
    this.cache.clear();
    if (this.enableStats) {
      // Reset stats but preserve eviction count
      this.stats.hits = 0;
      this.stats.misses = 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: Math.round(hitRate * 100) / 100, // 2 decimal places
      size: this.cache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get cache size (number of entries)
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get maximum cache size
   */
  get maxSize(): number {
    return this.cache.max;
  }
}

/**
 * Global response cache instance
 * Shared across all LLM client instances in the process
 */
let globalCache: ResponseCache | null = null;

/**
 * Get or create global response cache
 *
 * @example
 * ```typescript
 * const cache = getGlobalResponseCache()
 * const stats = cache.getStats()
 * // Hit rate: ${stats.hitRate}%
 * ```
 */
export function getGlobalResponseCache(options?: ResponseCacheOptions): ResponseCache {
  if (!globalCache) {
    globalCache = new ResponseCache(options);
  }
  return globalCache;
}

/**
 * Clear global response cache
 */
export function clearGlobalResponseCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}

/**
 * Calculate cost savings from response caching
 *
 * @example
 * ```typescript
 * const stats = cache.getStats()
 * const savings = calculateResponseCacheSavings(stats, {
 *   avgInputTokens: 3000,
 *   avgOutputTokens: 500,
 *   inputCostPerM: 3.0,
 *   outputCostPerM: 15.0,
 * })
 *
 * // Saved: $${savings.totalSaved.toFixed(2)}
 * // Avoided ${savings.tokensAvoided.toLocaleString()} tokens
 * ```
 */
export function calculateResponseCacheSavings(
  stats: CacheStats,
  pricing: {
    avgInputTokens: number;
    avgOutputTokens: number;
    inputCostPerM: number;
    outputCostPerM: number;
  },
): {
  totalSaved: number;
  tokensAvoided: number;
  requestsAvoided: number;
} {
  const requestsAvoided = stats.hits;
  const tokensAvoided = (pricing.avgInputTokens + pricing.avgOutputTokens) * requestsAvoided;

  const inputSaved = (requestsAvoided * pricing.avgInputTokens * pricing.inputCostPerM) / 1_000_000;
  const outputSaved =
    (requestsAvoided * pricing.avgOutputTokens * pricing.outputCostPerM) / 1_000_000;
  const totalSaved = inputSaved + outputSaved;

  return {
    totalSaved,
    tokensAvoided,
    requestsAvoided,
  };
}
