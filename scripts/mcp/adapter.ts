/**
 * MCP Adapter Framework
 *
 * Provides a base class for creating MCP (Model Context Protocol) server adapters
 * with built-in idempotency caching, retry logic, and lifecycle management.
 *
 * @dependencies
 * - node:crypto - Hash generation for idempotency keys
 */

import { createHash, randomBytes } from 'node:crypto';

// =============================================================================
// Types
// =============================================================================

/** Configuration for an MCP adapter */
export interface MCPConfig {
  /** Maximum retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelayMs?: number;
  /** Default idempotency TTL in milliseconds (default: 5 minutes) */
  defaultIdempotencyTTLMs?: number;
  /** Cache cleanup interval in milliseconds (default: 60 seconds) */
  cleanupIntervalMs?: number;
  /** Request timeout in milliseconds (default: 30 seconds) */
  timeoutMs?: number;
}

/** MCP request */
export interface MCPRequest {
  /** Action to execute */
  action: string;
  /** Request parameters */
  parameters?: Record<string, unknown>;
  /** Request options */
  options?: MCPRequestOptions;
}

/** MCP request options */
export interface MCPRequestOptions {
  /** Idempotency key for deduplication */
  idempotencyKey?: string;
  /** Idempotency TTL in milliseconds */
  idempotencyTTL?: number;
  /** Number of retries */
  retries?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/** MCP response metadata */
export interface MCPResponseMetadata {
  /** Whether the response was served from cache */
  cached?: boolean;
  /** Idempotency key used */
  idempotencyKey?: string;
  /** Number of retries performed */
  retries?: number;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Adapter name */
  adapter?: string;
}

/** MCP response */
export interface MCPResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Response metadata */
  metadata?: MCPResponseMetadata;
}

/** Cache statistics */
export interface CacheStats {
  /** Number of cached entries */
  size: number;
  /** Cached keys */
  keys: string[];
}

// =============================================================================
// Cache Entry
// =============================================================================

interface CacheEntry {
  response: MCPResponse;
  expiresAt: number;
}

// =============================================================================
// Default Config
// =============================================================================

const DEFAULT_MCP_CONFIG: Required<MCPConfig> = {
  maxRetries: 3,
  retryDelayMs: 1_000,
  defaultIdempotencyTTLMs: 5 * 60 * 1_000,
  cleanupIntervalMs: 60_000,
  timeoutMs: 30_000,
};

// =============================================================================
// MCP Adapter Base Class
// =============================================================================

/**
 * Abstract base class for MCP server adapters.
 *
 * Provides:
 * - Idempotency caching with configurable TTL
 * - Automatic retry logic with backoff
 * - Request validation
 * - Lifecycle management (dispose/cleanup)
 */
export abstract class MCPAdapter {
  protected readonly name: string;
  protected readonly config: Required<MCPConfig>;
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(name: string, config: MCPConfig = {}) {
    this.name = name;
    this.config = { ...DEFAULT_MCP_CONFIG, ...config };

    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredEntries(),
      this.config.cleanupIntervalMs,
    );
  }

  /**
   * Execute an MCP request with caching and retry support.
   */
  async execute(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();
    const idempotencyKey = request.options?.idempotencyKey;

    // Check cache first
    if (idempotencyKey) {
      const cached = this.getCachedResponse(idempotencyKey);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cached: true,
            idempotencyKey,
            adapter: this.name,
          },
        };
      }
    }

    // Validate the action
    if (!this.isValidAction(request.action)) {
      return {
        success: false,
        error: `Invalid action: ${request.action}`,
        metadata: {
          adapter: this.name,
          responseTimeMs: Date.now() - startTime,
        },
      };
    }

    // Execute with retry
    const maxRetries = request.options?.retries ?? this.config.maxRetries;
    let lastError: Error | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await this.executeWithTimeout(
          request,
          request.options?.timeout ?? this.config.timeoutMs,
        );

        const response: MCPResponse = {
          success: true,
          data,
          metadata: {
            adapter: this.name,
            responseTimeMs: Date.now() - startTime,
            retries: retryCount > 0 ? retryCount : undefined,
          },
        };

        if (idempotencyKey) {
          this.cacheResponse(
            idempotencyKey,
            response,
            request.options?.idempotencyTTL ?? this.config.defaultIdempotencyTTLMs,
          );
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (attempt < maxRetries - 1) {
          await this.delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    // All retries exhausted
    const response: MCPResponse = {
      success: false,
      error: lastError?.message ?? 'Unknown error',
      metadata: {
        adapter: this.name,
        responseTimeMs: Date.now() - startTime,
        retries: retryCount,
      },
    };

    if (idempotencyKey) {
      this.cacheResponse(
        idempotencyKey,
        response,
        request.options?.idempotencyTTL ?? this.config.defaultIdempotencyTTLMs,
      );
    }

    return response;
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clear all cached entries.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Dispose of the adapter and clean up resources.
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Abstract methods (must be implemented by subclasses)
  // ---------------------------------------------------------------------------

  /** Validate that the action is supported by this adapter. */
  protected abstract isValidAction(action: string): boolean;

  /** Get the auth header name for this adapter. */
  protected abstract getAuthHeaderName(): string;

  /** Execute the actual request (no retry/caching wrapper). */
  protected abstract executeRequest(request: MCPRequest): Promise<unknown>;

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getCachedResponse(key: string): MCPResponse | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.response;
  }

  private cacheResponse(key: string, response: MCPResponse, ttlMs: number): void {
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private async executeWithTimeout(request: MCPRequest, timeoutMs: number): Promise<unknown> {
    return Promise.race([
      this.executeRequest(request),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Idempotency Key Utilities
// =============================================================================

/**
 * Generate a deterministic idempotency key from a request.
 * Same request parameters produce the same key.
 */
export function generateIdempotencyKey(request: MCPRequest): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(request.parameters ?? {}))
    .digest('hex')
    .slice(0, 16);

  return `${request.action}:${hash}`;
}

/**
 * Generate a unique idempotency key (non-deterministic).
 * Each call produces a different key.
 */
export function generateUniqueIdempotencyKey(action: string): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');
  return `${action}:${timestamp}:${random}`;
}
