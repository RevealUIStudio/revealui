/**
 * Unified LLM Client
 *
 * Single interface for all LLM providers with fallback and rate limiting
 */

// Log redaction lives in @revealui/security — import `redactLogContext`
// (recursive walker) or `redactLogField` (single key/value).

import type { Database } from '@revealui/db/client';
import { decryptApiKey } from '@revealui/db/crypto';
import { tenantProviderConfigs, userApiKeys } from '@revealui/db/schema';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  CircuitBreakerOpenError,
} from '@revealui/resilience';
import { and, eq } from 'drizzle-orm';
import type { AuditStore } from '../audit/store.js';
import type { ProviderHealthMonitor } from './provider-health.js';
import type {
  Embedding,
  LLMChatOptions,
  LLMChunk,
  LLMEmbedOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamOptions,
  Message,
} from './providers/base.js';
import { GroqProvider, type GroqProviderConfig } from './providers/groq.js';
import {
  InferenceSnapsProvider,
  type InferenceSnapsProviderConfig,
} from './providers/inference-snaps.js';
import { OllamaProvider, type OllamaProviderConfig } from './providers/ollama.js';
import type { OpenAICompatConfig } from './providers/openai-compat.js';
import { VultrProvider, type VultrProviderConfig } from './providers/vultr.js';
import { type CacheStats, ResponseCache, type ResponseCacheOptions } from './response-cache.js';
import {
  SemanticCache,
  type SemanticCacheOptions,
  type SemanticCacheStats,
} from './semantic-cache.js';
import { estimateRequest as _estimateRequestTokens } from './token-counter.js';

export type LLMProviderType = 'vultr' | 'groq' | 'ollama' | 'huggingface' | 'inference-snaps';

export interface LLMClientConfig {
  provider: LLMProviderType;
  apiKey: string;
  /**
   * Dynamic API key resolver  -  called before every LLM request.
   * When set, the resolved key replaces `apiKey` on each call.
   * Use this for OAuth tokens or any credential that expires between requests.
   */
  apiKeyFn?: () => Promise<string>;
  baseURL?: string;
  model?: string;
  /**
   * Dedicated embedding provider. When set, all embed() calls are routed here
   * instead of the primary provider. Required when the primary provider does not
   * support embeddings natively.
   */
  embedProvider?: LLMProvider;
  temperature?: number;
  maxTokens?: number;
  fallbackProvider?: LLMProviderType;
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  /** Enable Anthropic prompt caching by default (90% cost reduction on cache hits) */
  enableCacheByDefault?: boolean;
  /** Enable response caching (100% cost savings on duplicate requests) */
  enableResponseCache?: boolean;
  /** Response cache options */
  responseCacheOptions?: ResponseCacheOptions;
  /** Enable semantic caching (73% cost reduction, 65% hit rate) */
  enableSemanticCache?: boolean;
  /** Semantic cache options */
  semanticCacheOptions?: SemanticCacheOptions;
  /** Optional health monitor  -  records latency + error rate per provider */
  healthMonitor?: ProviderHealthMonitor;
  /** Circuit breaker failure threshold before tripping (default: 5) */
  circuitBreakerFailureThreshold?: number;
  /** Circuit breaker reset timeout in ms before half-open probe (default: 30000) */
  circuitBreakerResetTimeout?: number;
}

interface RateLimitState {
  requests: number[];
  dailyRequests: number;
  lastReset: number;
}

export class LLMClient {
  private provider: LLMProvider;
  private fallbackProvider?: LLMProvider;
  private embedProviderOverride?: LLMProvider;
  private config: LLMClientConfig;
  private rateLimitState: RateLimitState;
  private responseCache?: ResponseCache;
  private semanticCache?: SemanticCache;
  private healthMonitor?: ProviderHealthMonitor;
  private circuitBreaker: CircuitBreaker;
  private fallbackCircuitBreaker?: CircuitBreaker;
  /** Tracks the last resolved API key so we only recreate the provider when it changes */
  private currentApiKey: string;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.currentApiKey = config.apiKey;
    this.rateLimitState = {
      requests: [],
      dailyRequests: 0,
      lastReset: Date.now(),
    };

    // Initialize response cache if enabled
    if (config.enableResponseCache) {
      this.responseCache = new ResponseCache(config.responseCacheOptions);
    }

    // Initialize semantic cache if enabled
    if (config.enableSemanticCache) {
      this.semanticCache = new SemanticCache(config.semanticCacheOptions);
    }

    // Wire health monitor if provided
    this.healthMonitor = config.healthMonitor;

    // Per-provider circuit breakers — isolate outages so one provider's failure
    // doesn't block calls to a different provider
    const cbConfig: CircuitBreakerConfig = {
      failureThreshold: config.circuitBreakerFailureThreshold ?? 5,
      resetTimeout: config.circuitBreakerResetTimeout ?? 30_000,
      successThreshold: 2,
    };
    this.circuitBreaker = new CircuitBreaker(cbConfig);
    if (config.fallbackProvider) {
      this.fallbackCircuitBreaker = new CircuitBreaker(cbConfig);
    }

    // Wire dedicated embed provider if supplied
    this.embedProviderOverride = config.embedProvider;

    // Create primary provider
    this.provider = this.createProvider(config.provider, {
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Create fallback provider if specified
    if (config.fallbackProvider) {
      this.fallbackProvider = this.createProvider(config.fallbackProvider, {
        apiKey: config.apiKey, // Note: In practice, you'd want separate API keys
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    }
  }

  private createProvider(
    type: LLMProviderType,
    config:
      | OpenAICompatConfig
      | VultrProviderConfig
      | GroqProviderConfig
      | OllamaProviderConfig
      | InferenceSnapsProviderConfig,
  ): LLMProvider {
    switch (type) {
      case 'vultr':
        return new VultrProvider(config as VultrProviderConfig);
      case 'groq':
        return new GroqProvider(config as GroqProviderConfig);
      case 'ollama':
        return new OllamaProvider(config as OllamaProviderConfig);
      case 'inference-snaps':
        return new InferenceSnapsProvider(config as InferenceSnapsProviderConfig);
      default:
        throw new Error(`Unknown provider type: ${String(type)}`);
    }
  }

  /**
   * Re-resolve the API key via apiKeyFn (if configured) and recreate the provider
   * when the key has changed. No-op if apiKeyFn is not set.
   */
  private async refreshProviderIfNeeded(): Promise<void> {
    if (!this.config.apiKeyFn) return;
    const newKey = await this.config.apiKeyFn();
    if (newKey === this.currentApiKey) return;

    this.currentApiKey = newKey;
    const providerConfig = {
      apiKey: newKey,
      baseURL: this.config.baseURL,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    };
    this.provider = this.createProvider(this.config.provider, providerConfig);
    if (this.config.fallbackProvider) {
      this.fallbackProvider = this.createProvider(this.config.fallbackProvider, providerConfig);
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const { rateLimit } = this.config;

    if (!rateLimit) {
      return true;
    }

    // Reset daily counter if needed
    if (now - this.rateLimitState.lastReset > 24 * 60 * 60 * 1000) {
      this.rateLimitState.dailyRequests = 0;
      this.rateLimitState.lastReset = now;
    }

    // Check per-minute limit
    if (rateLimit.requestsPerMinute) {
      const oneMinuteAgo = now - 60 * 1000;
      this.rateLimitState.requests = this.rateLimitState.requests.filter(
        (time) => time > oneMinuteAgo,
      );

      if (this.rateLimitState.requests.length >= rateLimit.requestsPerMinute) {
        return false;
      }
    }

    // Check daily limit
    if (rateLimit.requestsPerDay) {
      if (this.rateLimitState.dailyRequests >= rateLimit.requestsPerDay) {
        return false;
      }
    }

    return true;
  }

  private recordRequest(): void {
    const now = Date.now();
    this.rateLimitState.requests.push(now);
    this.rateLimitState.dailyRequests++;
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    await this.refreshProviderIfNeeded();
    // Check semantic cache first (if enabled)
    // Semantic cache is more powerful - matches similar queries, not just exact matches
    if (this.semanticCache) {
      const query = this.semanticCache.extractQuery(messages);
      const cached = await this.semanticCache.get(query);
      if (cached) {
        // Semantic cache hit - return immediately without API call
        return {
          content: cached.response,
          role: 'assistant',
          finishReason: 'stop',
          usage: cached.usage
            ? {
                ...cached.usage,
                // Mark as cached for monitoring
                cacheReadTokens: cached.usage.totalTokens,
              }
            : undefined,
        };
      }
    }

    // Check response cache (if enabled and semantic cache didn't hit)
    if (this.responseCache) {
      const cacheKey = this.responseCache.getCacheKey(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        tools: options?.tools,
        model: this.config.model,
      });

      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        // Cache hit - return immediately without API call
        return {
          ...cached,
          usage: cached.usage
            ? {
                ...cached.usage,
                // Mark as cached for monitoring
                cacheReadTokens: cached.usage.totalTokens,
              }
            : undefined,
        };
      }

      // Cache miss - proceed with API call
    }

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const callStart = Date.now();
    try {
      this.recordRequest();
      const response = await this.circuitBreaker.execute(() =>
        this.provider.chat(messages, options),
      );
      this.healthMonitor?.recordCall(this.config.provider, Date.now() - callStart);

      // Store in semantic cache (if enabled)
      if (this.semanticCache) {
        const query = this.semanticCache.extractQuery(messages);
        await this.semanticCache.set(query, response.content, response.usage);
      }

      // Store in response cache (if enabled)
      if (this.responseCache) {
        const cacheKey = this.responseCache.getCacheKey(messages, {
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          tools: options?.tools,
          model: this.config.model,
        });

        this.responseCache.set(cacheKey, {
          content: response.content,
          role: response.role,
          finishReason: response.finishReason,
          toolCalls: response.toolCalls,
          timestamp: Date.now(),
          usage: response.usage,
        });
      }

      return response;
    } catch (error) {
      this.healthMonitor?.recordCall(
        this.config.provider,
        Date.now() - callStart,
        error instanceof Error ? error : new Error(String(error)),
      );
      // Try fallback if available
      if (this.fallbackProvider && this.config.fallbackProvider) {
        const fp = this.fallbackProvider;
        const fallbackStart = Date.now();
        try {
          const fb = this.fallbackCircuitBreaker
            ? await this.fallbackCircuitBreaker.execute(() => fp.chat(messages, options))
            : await fp.chat(messages, options);
          this.healthMonitor?.recordCall(this.config.fallbackProvider, Date.now() - fallbackStart);
          return fb;
        } catch (fallbackError) {
          this.healthMonitor?.recordCall(
            this.config.fallbackProvider,
            Date.now() - fallbackStart,
            fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
          );
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      throw error;
    }
  }

  async embed(
    text: string | string[],
    options?: LLMEmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    await this.refreshProviderIfNeeded();
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    // Use dedicated embed provider if one was configured
    const embedProvider = this.embedProviderOverride ?? this.provider;

    try {
      this.recordRequest();
      return await this.circuitBreaker.execute(() => embedProvider.embed(text, options));
    } catch (error) {
      // Try fallback if available (only when using the primary provider path)
      if (!this.embedProviderOverride && this.fallbackProvider) {
        const fp = this.fallbackProvider;
        try {
          return this.fallbackCircuitBreaker
            ? await this.fallbackCircuitBreaker.execute(() => fp.embed(text, options))
            : await fp.embed(text, options);
        } catch {
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      throw error;
    }
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    await this.refreshProviderIfNeeded();
    // Note: Streaming is not cached (can't cache partial responses)
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      // Circuit breaker check — streaming can't use execute() wrapper
      // so we check state and record outcomes manually
      if (this.circuitBreaker.isOpen()) {
        throw new CircuitBreakerOpenError(`llm-${this.config.provider}`);
      }
      this.recordRequest();
      yield* this.provider.stream(messages, options);
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        try {
          if (this.fallbackCircuitBreaker?.isOpen()) {
            throw new CircuitBreakerOpenError(`llm-${this.config.fallbackProvider}`);
          }
          yield* this.fallbackProvider.stream(messages, options);
        } catch {
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Estimate token count and cost for a set of messages using the configured model.
   * Uses a heuristic (~4 chars/token). Useful for pre-flight cost checks.
   */
  estimateRequest(messages: Message[]): { tokens: number; estimatedCostUsd: number } {
    return _estimateRequestTokens(messages, this.config.model ?? '');
  }

  /**
   * Get circuit breaker stats for the primary and fallback providers.
   */
  getCircuitBreakerStats(): {
    primary: { name: string; state: string; stats: ReturnType<CircuitBreaker['getStats']> };
    fallback?: { name: string; state: string; stats: ReturnType<CircuitBreaker['getStats']> };
  } {
    return {
      primary: {
        name: `llm-${this.config.provider}`,
        state: this.circuitBreaker.getState(),
        stats: this.circuitBreaker.getStats(),
      },
      fallback:
        this.fallbackCircuitBreaker && this.config.fallbackProvider
          ? {
              name: `llm-${this.config.fallbackProvider}`,
              state: this.fallbackCircuitBreaker.getState(),
              stats: this.fallbackCircuitBreaker.getStats(),
            }
          : undefined,
    };
  }

  /**
   * Get the provider health monitor if one was configured.
   */
  getHealthMonitor(): ProviderHealthMonitor | undefined {
    return this.healthMonitor;
  }

  /**
   * Get response cache statistics
   *
   * @returns Cache stats or undefined if caching is disabled
   */
  getResponseCacheStats(): CacheStats | undefined {
    return this.responseCache?.getStats();
  }

  /**
   * Clear response cache
   */
  clearResponseCache(): void {
    this.responseCache?.clear();
  }

  /**
   * Get semantic cache statistics
   *
   * @returns Semantic cache stats or undefined if caching is disabled
   */
  getSemanticCacheStats(): SemanticCacheStats | undefined {
    return this.semanticCache?.getStats();
  }

  /**
   * Clear semantic cache
   */
  clearSemanticCache(): void {
    this.semanticCache?.resetStats();
  }
}

/**
 * Create an LLM client from environment variables.
 *
 * When LLM_PROVIDER is not set, auto-detects the provider by checking env vars
 * in priority order: INFERENCE_SNAPS → GROQ → OLLAMA.
 *
 * All providers use OpenAI-compatible APIs. No proprietary provider SDKs.
 *
 * Provider defaults:
 *   groq   → qwen/qwen3-32b
 *   ollama → gemma4:e2b
 */
export function createLLMClientFromEnv(): LLMClient {
  // Auto-detect provider when LLM_PROVIDER is not explicitly set
  let provider: LLMProviderType;
  if (process.env.LLM_PROVIDER) {
    provider = process.env.LLM_PROVIDER as LLMProviderType;
  } else if (process.env.INFERENCE_SNAPS_BASE_URL) {
    provider = 'inference-snaps';
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
  } else if (process.env.OLLAMA_BASE_URL) {
    provider = 'ollama';
  } else {
    throw new Error(
      'No LLM provider configured. Set one of: OLLAMA_BASE_URL (local Ollama), ' +
        'INFERENCE_SNAPS_BASE_URL (local snap), GROQ_API_KEY (cloud). ' +
        'Alternatively, set LLM_PROVIDER explicitly.',
    );
  }

  let apiKey: string | undefined;
  let baseURL: string | undefined;
  let defaultModel: string | undefined;

  if (provider === 'vultr') {
    apiKey = process.env.VULTR_API_KEY;
    baseURL = process.env.VULTR_BASE_URL;
  } else if (provider === 'huggingface') {
    apiKey = process.env.HF_TOKEN;
    baseURL = process.env.HF_MODEL_URL;
  } else if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY;
    baseURL = process.env.GROQ_BASE_URL;
    defaultModel = 'qwen/qwen3-32b';
  } else if (provider === 'ollama') {
    apiKey = 'ollama'; // Ollama ignores the API key
    // Ollama's OpenAI-compatible endpoint lives at /v1
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    baseURL = ollamaBase.endsWith('/v1') ? ollamaBase : `${ollamaBase}/v1`;
    defaultModel = 'gemma4:e2b';
  } else if (provider === 'inference-snaps') {
    apiKey = 'inference-snaps'; // inference-snaps ignores the API key
    baseURL = process.env.INFERENCE_SNAPS_BASE_URL;
    defaultModel = 'gemma3';
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider "${provider}". Set the corresponding env var ` +
        `(INFERENCE_SNAPS_BASE_URL, GROQ_API_KEY, OLLAMA_BASE_URL, VULTR_API_KEY, or HF_TOKEN).`,
    );
  }

  return new LLMClient({
    provider,
    apiKey,
    baseURL,
    model: process.env.LLM_MODEL ?? defaultModel,
    temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : undefined,
    enableCacheByDefault:
      process.env.LLM_ENABLE_CACHE === 'true' || process.env.ANTHROPIC_ENABLE_CACHE === 'true',
    enableResponseCache:
      process.env.LLM_ENABLE_RESPONSE_CACHE === 'true' ||
      process.env.RESPONSE_CACHE_ENABLED === 'true',
    enableSemanticCache:
      process.env.LLM_ENABLE_SEMANTIC_CACHE === 'true' ||
      process.env.SEMANTIC_CACHE_ENABLED === 'true',
  });
}

/**
 * Create an LLM client using a user's stored BYOK API key.
 *
 * Looks up the user's preferred provider from `tenant_provider_configs`
 * (falling back to the first key in `user_api_keys`), decrypts the key
 * with AES-256-GCM, and returns a configured LLMClient.
 *
 * Returns `null` if the user has no stored keys (callers should fall back
 * to `createLLMClientFromEnv()` or return a 402/feature-unavailable error).
 *
 * @param userId - The user's ID from the `users` table
 * @param db - A Drizzle NeonDB client instance
 */
export async function createLLMClientForUser(
  userId: string,
  db: Database,
  auditStore?: AuditStore,
): Promise<LLMClient | null> {
  // Find the user's preferred provider config
  const [preferredConfig] = await db
    .select()
    .from(tenantProviderConfigs)
    .where(and(eq(tenantProviderConfigs.userId, userId), eq(tenantProviderConfigs.isDefault, true)))
    .limit(1);

  // Find the matching API key (preferred provider, or any available key)
  const keyQuery = db
    .select()
    .from(userApiKeys)
    .where(
      preferredConfig
        ? and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, preferredConfig.provider))
        : eq(userApiKeys.userId, userId),
    )
    .limit(1);

  const [keyRow] = await keyQuery;

  if (!keyRow) return null;

  const plaintext = decryptApiKey(keyRow.encryptedKey);
  const provider = keyRow.provider as LLMProviderType;
  const model = preferredConfig?.model ?? undefined;

  // Fire-and-forget: record when this key was last used (best-effort, never blocks)
  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, keyRow.id))
    .catch(() => undefined);

  // Fire-and-forget: emit BYOK audit event if an audit store is wired up
  if (auditStore) {
    auditStore
      .append({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: 'byok:key:accessed',
        severity: 'info',
        agentId: 'system',
        payload: { userId, provider, keyId: keyRow.id },
        policyViolations: [],
      })
      .catch(() => undefined);
  }

  return new LLMClient({ provider, apiKey: plaintext, model });
}
