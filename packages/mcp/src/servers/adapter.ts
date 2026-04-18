#!/usr/bin/env tsx

/**
 * MCP Adapter - Generic Model Context Protocol Integration
 *
 * Provides a unified interface for all MCP server integrations,
 * eliminating code duplication across different service adapters.
 *
 * Usage:
 *   const adapter = new MCPAdapter('vercel', config)
 *   await adapter.execute(request)
 */

import { randomBytes } from 'node:crypto';
import { registerCleanupHandler } from '@revealui/core/monitoring';
import { logger as coreLogger } from '@revealui/core/observability/logger';
import { assertPublicUrl } from '@revealui/security';

export enum McpErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

export class McpError extends Error {
  code: McpErrorCode;
  constructor(message: string, code: McpErrorCode) {
    super(message);
    this.name = 'McpError';
    this.code = code;
  }
}

// Alias for backwards compatibility within this file
const ErrorCode = McpErrorCode;
const ScriptError = McpError;

// =============================================================================
// Global Adapter Registry
// =============================================================================

/**
 * Track all active MCP adapters for cleanup
 */
const activeAdapters: Set<MCPAdapter> = new Set();

/**
 * Dispose all active MCP adapters (cleanup on shutdown)
 */
export function disposeAllAdapters(): void {
  for (const adapter of activeAdapters) {
    try {
      adapter.dispose();
    } catch (error) {
      coreLogger.error(
        'Failed to dispose adapter',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  activeAdapters.clear();
}

// Register cleanup handler
let cleanupHandlerRegistered = false;
function registerAdapterCleanup() {
  if (cleanupHandlerRegistered) return;

  registerCleanupHandler(
    'mcp-adapters',
    () => {
      disposeAllAdapters();
    },
    'Dispose all MCP adapters',
    90, // High priority
  );

  cleanupHandlerRegistered = true;
}

export interface MCPRequest {
  action: string;
  parameters?: Record<string, unknown>;
  options?: {
    timeout?: number;
    retries?: number;
    dryRun?: boolean;
    /** Idempotency key to prevent duplicate operations */
    idempotencyKey?: string;
    /** TTL for idempotency cache in milliseconds (default: 5 minutes) */
    idempotencyTTL?: number;
  };
}

export interface MCPResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    duration: number;
    retries: number;
    service: string;
    /** Indicates this response was served from idempotency cache */
    cached?: boolean;
    /** The idempotency key that was used */
    idempotencyKey?: string;
  };
}

// =============================================================================
// Idempotency Cache
// =============================================================================

interface CachedResponse {
  response: MCPResponse;
  expiresAt: number;
}

/**
 * Persistent backend for idempotency cache.
 * Implementations handle their own TTL expiration for stored entries.
 */
export interface IdempotencyStore {
  get(key: string): Promise<{ response: MCPResponse; expiresAt: number } | null>;
  set(key: string, response: MCPResponse, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * In-memory idempotency cache for preventing duplicate operations.
 * Each adapter instance has its own cache. Optionally backed by a
 * persistent {@link IdempotencyStore} for cross-process durability.
 */
class IdempotencyCache {
  private cache = new Map<string, CachedResponse>();
  private store: IdempotencyStore | null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  // biome-ignore lint/style/useNamingConvention: Constant should be uppercase
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(store?: IdempotencyStore) {
    this.store = store ?? null;
    // Cleanup expired entries every minute (memory only  -  store manages its own TTL)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get a cached response by idempotency key.
   * Checks memory first, then falls through to the persistent store.
   */
  async get(key: string): Promise<MCPResponse | null> {
    // Check memory first
    const cached = this.cache.get(key);
    if (cached) {
      if (Date.now() > cached.expiresAt) {
        this.cache.delete(key);
      } else {
        return {
          ...cached.response,
          metadata: {
            ...cached.response.metadata,
            cached: true,
            idempotencyKey: key,
          },
        } as MCPResponse;
      }
    }

    // Fall through to persistent store if available
    if (this.store) {
      const stored = await this.store.get(key);
      if (!stored) return null;

      // Populate memory cache on store hit
      this.cache.set(key, { response: stored.response, expiresAt: stored.expiresAt });

      return {
        ...stored.response,
        metadata: {
          ...stored.response.metadata,
          cached: true,
          idempotencyKey: key,
        },
      } as MCPResponse;
    }

    return null;
  }

  /**
   * Store a response with idempotency key.
   * Writes to both memory and the persistent store (if configured).
   */
  set(key: string, response: MCPResponse, ttl?: number): void {
    const ttlMs = ttl || this.DEFAULT_TTL;
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { response, expiresAt });

    // Fire-and-forget write to persistent store
    if (this.store) {
      this.store.set(key, response, ttlMs).catch(() => {
        // Persistent store write failures are non-fatal  -  memory cache still works
      });
    }
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove expired entries (memory only  -  store manages its own TTL)
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Stop the cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export interface MCPConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  environment?: 'development' | 'production';
}

export abstract class MCPAdapter {
  protected serviceName: string;
  protected config: MCPConfig;
  protected logger = coreLogger;
  protected idempotencyCache = new IdempotencyCache();

  constructor(serviceName: string, config: MCPConfig) {
    this.serviceName = serviceName;
    this.config = {
      timeout: 30000,
      retries: 3,
      environment: 'development',
      ...config,
    };

    // Register adapter for cleanup
    activeAdapters.add(this);
    registerAdapterCleanup();
  }

  /**
   * Dispose of adapter resources (cleanup idempotency cache)
   */
  dispose(): void {
    this.idempotencyCache.dispose();
    activeAdapters.delete(this);
  }

  /**
   * Get idempotency cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.idempotencyCache.stats();
  }

  /**
   * Clear the idempotency cache
   */
  clearCache(): void {
    this.idempotencyCache.clear();
  }

  /**
   * Execute an MCP request
   *
   * If an idempotencyKey is provided in options, the request will be checked
   * against the cache. If a cached response exists, it will be returned
   * immediately. Otherwise, the request will be executed and the response
   * will be cached for future duplicate requests.
   */
  async execute(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();
    let attempts = 0;
    const idempotencyKey = request.options?.idempotencyKey;

    try {
      this.validateRequest(request);

      // Check idempotency cache first
      if (idempotencyKey) {
        const cached = await this.idempotencyCache.get(idempotencyKey);
        if (cached) {
          this.logger.info(
            `[${this.serviceName}] Returning cached response for idempotency key: ${idempotencyKey}`,
          );
          return cached;
        }
      }

      if (request.options?.dryRun) {
        return this.createDryRunResponse(request);
      }

      while (attempts < (request.options?.retries || this.config.retries || 3)) {
        attempts++;

        try {
          this.logger.info(
            `[${this.serviceName}] Executing ${request.action} (attempt ${attempts})`,
          );

          const result = await this.executeRequest(request);

          const duration = Date.now() - startTime;
          const response: MCPResponse = {
            success: true,
            data: result,
            metadata: {
              duration,
              retries: attempts - 1,
              service: this.serviceName,
              ...(idempotencyKey && { idempotencyKey }),
            },
          };

          // Cache successful response if idempotency key provided
          if (idempotencyKey) {
            this.idempotencyCache.set(idempotencyKey, response, request.options?.idempotencyTTL);
          }

          return response;
        } catch (error) {
          this.logger.warn(`[${this.serviceName}] Attempt ${attempts} failed: ${error}`);

          if (attempts >= (request.options?.retries || this.config.retries || 3)) {
            throw error;
          }

          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * 2 ** (attempts - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw new ScriptError('All retry attempts exhausted', ErrorCode.TIMEOUT_ERROR);
    } catch (error) {
      const duration = Date.now() - startTime;
      const response: MCPResponse = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          duration,
          retries: attempts,
          service: this.serviceName,
          ...(idempotencyKey && { idempotencyKey }),
        },
      };

      // Also cache failed responses to prevent duplicate attempts
      // This prevents the same failing request from being retried repeatedly
      if (idempotencyKey) {
        this.idempotencyCache.set(idempotencyKey, response, request.options?.idempotencyTTL);
      }

      return response;
    }
  }

  /**
   * Validate the incoming request
   */
  protected validateRequest(request: MCPRequest): void {
    if (!request.action) {
      throw new ScriptError('Request must include an action', ErrorCode.VALIDATION_ERROR);
    }

    if (!this.isValidAction(request.action)) {
      throw new ScriptError(`Unsupported action: ${request.action}`, ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Check if an action is supported by this adapter
   */
  protected abstract isValidAction(action: string): boolean;

  /**
   * Execute the actual request (implemented by subclasses)
   */
  protected abstract executeRequest(request: MCPRequest): Promise<unknown>;

  /**
   * Create a dry-run response
   */
  protected createDryRunResponse(request: MCPRequest): MCPResponse {
    return {
      success: true,
      data: {
        dryRun: true,
        action: request.action,
        parameters: request.parameters,
        message: `Would execute ${request.action} on ${this.serviceName}`,
      },
    };
  }

  /**
   * Get authentication headers for API calls
   */
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `RevealUI-MCP/${this.serviceName}`,
    };

    if (this.config.apiKey) {
      // Different services use different header names
      const headerName = this.getAuthHeaderName();
      headers[headerName] = this.config.apiKey;
    }

    return headers;
  }

  /**
   * Get the authentication header name for this service
   */
  protected abstract getAuthHeaderName(): string;

  /**
   * Make an HTTP request with proper error handling
   */
  protected async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
  ): Promise<unknown> {
    const headers = this.getAuthHeaders();
    const timeout = this.config.timeout || 30000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      // SSRF protection: resolve hostname and reject private/reserved IPs
      // before sending credentials to an attacker-controlled endpoint.
      await assertPublicUrl(url);

      const response = await fetch(url, {
        method,
        headers,
        body: data && (method === 'POST' || method === 'PUT') ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ScriptError(
          `HTTP ${response.status} ${response.statusText}`,
          ErrorCode.NETWORK_ERROR,
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      if (error instanceof ScriptError) throw error;
      throw new ScriptError(
        `Request to ${this.serviceName} failed: ${error}`,
        ErrorCode.NETWORK_ERROR,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// Specific service adapters

export class VercelAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('vercel', config);
  }

  protected isValidAction(action: string): boolean {
    return ['deploy', 'list-deployments', 'get-deployment', 'delete-deployment'].includes(action);
  }

  protected getAuthHeaderName(): string {
    return 'Authorization';
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://api.vercel.com';

    switch (request.action) {
      case 'deploy':
        return this.makeRequest('POST', `${baseUrl}/v13/deployments`, request.parameters);

      case 'list-deployments':
        return this.makeRequest('GET', `${baseUrl}/v6/deployments`);

      case 'get-deployment': {
        const { id } = request.parameters || {};
        if (!id) throw new ScriptError('Deployment ID required', ErrorCode.VALIDATION_ERROR);
        return this.makeRequest('GET', `${baseUrl}/v13/deployments/${String(id)}`);
      }

      case 'delete-deployment': {
        const { deploymentId } = request.parameters || {};
        if (!deploymentId)
          throw new ScriptError('Deployment ID required', ErrorCode.VALIDATION_ERROR);
        return this.makeRequest('DELETE', `${baseUrl}/v13/deployments/${String(deploymentId)}`);
      }

      default:
        throw new ScriptError(`Unsupported action: ${request.action}`, ErrorCode.VALIDATION_ERROR);
    }
  }
}

export class StripeAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('stripe', config);
  }

  protected isValidAction(action: string): boolean {
    return [
      'create-payment-intent',
      'list-payment-intents',
      'create-customer',
      'list-customers',
    ].includes(action);
  }

  protected getAuthHeaderName(): string {
    return 'Authorization';
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://api.stripe.com/v1';

    switch (request.action) {
      case 'create-payment-intent':
        return this.makeRequest('POST', `${baseUrl}/payment_intents`, request.parameters);

      case 'list-payment-intents':
        return this.makeRequest('GET', `${baseUrl}/payment_intents`);

      case 'create-customer':
        return this.makeRequest('POST', `${baseUrl}/customers`, request.parameters);

      case 'list-customers':
        return this.makeRequest('GET', `${baseUrl}/customers`);

      default:
        throw new ScriptError(`Unsupported action: ${request.action}`, ErrorCode.VALIDATION_ERROR);
    }
  }
}

export class NeonAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('neon', config);
  }

  protected isValidAction(action: string): boolean {
    return ['list-projects', 'create-project', 'get-project', 'delete-project'].includes(action);
  }

  protected getAuthHeaderName(): string {
    return 'Authorization';
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://console.neon.tech/api/v2';

    switch (request.action) {
      case 'list-projects':
        return this.makeRequest('GET', `${baseUrl}/projects`);

      case 'create-project':
        return this.makeRequest('POST', `${baseUrl}/projects`, request.parameters);

      case 'get-project': {
        const { id } = request.parameters || {};
        if (!id) throw new ScriptError('Project ID required', ErrorCode.VALIDATION_ERROR);
        return this.makeRequest('GET', `${baseUrl}/projects/${String(id)}`);
      }

      case 'delete-project': {
        const { projectId } = request.parameters || {};
        if (!projectId) throw new ScriptError('Project ID required', ErrorCode.VALIDATION_ERROR);
        return this.makeRequest('DELETE', `${baseUrl}/projects/${String(projectId)}`);
      }

      default:
        throw new ScriptError(`Unsupported action: ${request.action}`, ErrorCode.VALIDATION_ERROR);
    }
  }
}

// Factory function to create adapters
export function createMCPAdapter(service: string, config: MCPConfig): MCPAdapter {
  switch (service.toLowerCase()) {
    case 'vercel':
      return new VercelAdapter(config);
    case 'stripe':
      return new StripeAdapter(config);
    case 'neon':
      return new NeonAdapter(config);
    default:
      throw new ScriptError(`Unsupported MCP service: ${service}`, ErrorCode.CONFIG_ERROR);
  }
}

/**
 * Generate an idempotency key based on the request content.
 *
 * This creates a deterministic key from the action and parameters,
 * so identical requests will get the same key.
 *
 * @example
 * ```typescript
 * const key = generateIdempotencyKey({
 *   action: 'deploy',
 *   parameters: { projectId: '123' }
 * })
 * // Returns: "deploy:a1b2c3d4e5f6..."
 * ```
 */
export function generateIdempotencyKey(request: MCPRequest): string {
  const content = JSON.stringify({
    action: request.action,
    parameters: request.parameters || {},
  });

  // Simple hash function for generating consistent keys
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to positive hex string
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${request.action}:${hashHex}`;
}

/**
 * Generate a unique idempotency key with timestamp.
 *
 * Use this when you want each request to be unique but still
 * want idempotency protection against rapid duplicate submissions.
 *
 * @example
 * ```typescript
 * const key = generateUniqueIdempotencyKey('deploy')
 * // Returns: "deploy:1706536800000:a1b2c3d4"
 * ```
 */
export function generateUniqueIdempotencyKey(action: string): string {
  const timestamp = Date.now();
  const random = randomBytes(6).toString('hex');
  return `${action}:${timestamp}:${random}`;
}
