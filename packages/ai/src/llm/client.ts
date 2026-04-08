/**
 * Unified LLM Client
 *
 * Single interface for all LLM providers with fallback and rate limiting
 */

// =============================================================================
// Log redaction
// =============================================================================

const SENSITIVE_KEYS = new Set([
  'apiKey',
  'api_key',
  'authorization',
  'Authorization',
  'x-ai-api-key',
  'X-AI-Api-Key',
  'token',
  'secret',
  'password',
  'encryptedKey',
  'encrypted_key',
]);

/**
 * Redact sensitive fields before passing an object to a logger.
 * Replaces API keys, tokens, and authorization headers with `[REDACTED]`.
 * Recurses into nested plain objects; leaves arrays and primitives as-is.
 */
export function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================

import type { Database } from '@revealui/db/client';
import { decryptApiKey } from '@revealui/db/crypto';
import { tenantProviderConfigs, userApiKeys } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import type { AuditStore } from '../audit/store.js';
import type { ProviderHealthMonitor } from './provider-health.js';
import { AnthropicProvider, type AnthropicProviderConfig } from './providers/anthropic.js';
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
import { BitnetProvider, type BitnetProviderConfig } from './providers/bitnet.js';
import { GroqProvider, type GroqProviderConfig } from './providers/groq.js';
import {
  InferenceSnapsProvider,
  type InferenceSnapsProviderConfig,
} from './providers/inference-snaps.js';
import { OllamaProvider, type OllamaProviderConfig } from './providers/ollama.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './providers/openai.js';
import { VultrProvider, type VultrProviderConfig } from './providers/vultr.js';
import { type CacheStats, ResponseCache, type ResponseCacheOptions } from './response-cache.js';
import {
  SemanticCache,
  type SemanticCacheOptions,
  type SemanticCacheStats,
} from './semantic-cache.js';
import { estimateRequest as _estimateRequestTokens } from './token-counter.js';

export type LLMProviderType =
  | 'openai'
  | 'anthropic'
  | 'vultr'
  | 'groq'
  | 'ollama'
  | 'bitnet'
  | 'huggingface'
  | 'inference-snaps';

export interface LLMClientConfig {
  provider: LLMProviderType;
  apiKey: string;
  /**
   * Dynamic API key resolver — called before every LLM request.
   * When set, the resolved key replaces `apiKey` on each call.
   * Use this for OAuth tokens or any credential that expires between requests.
   */
  apiKeyFn?: () => Promise<string>;
  baseURL?: string;
  model?: string;
  /**
   * Dedicated embedding provider. When set, all embed() calls are routed here
   * instead of the primary provider. Required when the primary provider does not
   * support embeddings (e.g. BitNet).
   *
   * Auto-wired by createLLMClientFromEnv() when BITNET_BASE_URL + OLLAMA_BASE_URL
   * are both set.
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
  /** Optional health monitor — records latency + error rate per provider */
  healthMonitor?: ProviderHealthMonitor;
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

    // Wire dedicated embed provider if supplied (e.g. Ollama when BitNet is primary)
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
      | OpenAIProviderConfig
      | AnthropicProviderConfig
      | VultrProviderConfig
      | GroqProviderConfig
      | OllamaProviderConfig
      | BitnetProviderConfig
      | InferenceSnapsProviderConfig,
  ): LLMProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config as OpenAIProviderConfig);
      case 'anthropic':
        return new AnthropicProvider({
          ...(config as AnthropicProviderConfig),
          enableCacheByDefault: this.config.enableCacheByDefault,
        });
      case 'vultr':
        return new VultrProvider(config as VultrProviderConfig);
      case 'groq':
        return new GroqProvider(config as GroqProviderConfig);
      case 'ollama':
        return new OllamaProvider(config as OllamaProviderConfig);
      case 'bitnet':
        return new BitnetProvider(config as BitnetProviderConfig);
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
      const response = await this.provider.chat(messages, options);
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
        const fallbackStart = Date.now();
        try {
          const fallbackResponse = await this.fallbackProvider.chat(messages, options);
          this.healthMonitor?.recordCall(this.config.fallbackProvider, Date.now() - fallbackStart);
          return fallbackResponse;
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

    // Use dedicated embed provider if one was configured (e.g. Ollama when BitNet is primary)
    const embedProvider = this.embedProviderOverride ?? this.provider;

    try {
      this.recordRequest();
      return await embedProvider.embed(text, options);
    } catch (error) {
      // Try fallback if available (only when using the primary provider path)
      if (!this.embedProviderOverride && this.fallbackProvider) {
        try {
          return await this.fallbackProvider.embed(text, options);
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
      this.recordRequest();
      yield* this.provider.stream(messages, options);
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        try {
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
 * in priority order: GROQ_API_KEY → OLLAMA_BASE_URL → ANTHROPIC_API_KEY.
 *
 * GROQ and Ollama are preferred — they are free-tier and BYOK-friendly.
 * OpenAI is not in the auto-detection chain (no revenue yet — see LLM provider policy).
 * To use OpenAI, set LLM_PROVIDER=openai explicitly.
 *
 * Provider defaults:
 *   groq   → llama-3.3-70b-versatile
 *   ollama → llama3.2:3b
 */
export function createLLMClientFromEnv(): LLMClient {
  // Auto-detect provider when LLM_PROVIDER is not explicitly set
  let provider: LLMProviderType;
  if (process.env.LLM_PROVIDER) {
    provider = process.env.LLM_PROVIDER as LLMProviderType;
  } else if (process.env.INFERENCE_SNAPS_BASE_URL) {
    provider = 'inference-snaps';
  } else if (process.env.BITNET_BASE_URL) {
    provider = 'bitnet';
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
  } else if (process.env.OLLAMA_BASE_URL) {
    provider = 'ollama';
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = 'anthropic';
  } else {
    // No provider configured — throw a clear error. OpenAI is intentionally excluded from
    // auto-detection (no revenue yet). Set LLM_PROVIDER=openai explicitly if needed.
    throw new Error(
      'No LLM provider configured. Set one of: BITNET_BASE_URL (local BitNet), ' +
        'INFERENCE_SNAPS_BASE_URL (local snap), GROQ_API_KEY (recommended cloud), ' +
        'OLLAMA_BASE_URL (local Ollama), or ANTHROPIC_API_KEY. ' +
        'Alternatively, set LLM_PROVIDER explicitly.',
    );
  }

  let apiKey: string | undefined;
  let baseURL: string | undefined;
  let defaultModel: string | undefined;

  if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY;
    baseURL = process.env.OPENAI_BASE_URL;
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY;
    baseURL = process.env.ANTHROPIC_BASE_URL;
  } else if (provider === 'vultr') {
    apiKey = process.env.VULTR_API_KEY;
    baseURL = process.env.VULTR_BASE_URL;
  } else if (provider === 'huggingface') {
    apiKey = process.env.HF_TOKEN;
    baseURL = process.env.HF_MODEL_URL;
  } else if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY;
    baseURL = process.env.GROQ_BASE_URL;
    defaultModel = 'llama-3.3-70b-versatile';
  } else if (provider === 'ollama') {
    apiKey = 'ollama'; // Ollama ignores the API key
    // Ollama's OpenAI-compatible endpoint lives at /v1
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    baseURL = ollamaBase.endsWith('/v1') ? ollamaBase : `${ollamaBase}/v1`;
    defaultModel = 'llama3.2:3b';
  } else if (provider === 'bitnet') {
    apiKey = 'bitnet'; // llama-server ignores the API key
    baseURL = process.env.BITNET_BASE_URL;
    defaultModel = 'bitnet-b1.58-2B-4T';
  } else if (provider === 'inference-snaps') {
    apiKey = 'inference-snaps'; // inference-snaps ignores the API key
    baseURL = process.env.INFERENCE_SNAPS_BASE_URL;
    defaultModel = 'gemma3';
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider "${provider}". Set the corresponding env var ` +
        `(INFERENCE_SNAPS_BASE_URL, GROQ_API_KEY, OLLAMA_BASE_URL, ANTHROPIC_API_KEY, or OPENAI_API_KEY).`,
    );
  }

  // When BitNet is the chat provider, auto-wire Ollama as the embed backend.
  // BitNet does not support /v1/embeddings; Ollama (nomic-embed-text) fills that role.
  // If OLLAMA_BASE_URL is not set, embed() will throw with a helpful message.
  let embedProvider: LLMProvider | undefined;
  if (provider === 'bitnet' && process.env.OLLAMA_BASE_URL) {
    embedProvider = new OllamaProvider({
      apiKey: 'ollama',
      baseURL: process.env.OLLAMA_BASE_URL,
      embedModel: process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text',
    });
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
    embedProvider,
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
