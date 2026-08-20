/**
 * Unified LLM Client
 *
 * Single interface for all LLM providers with fallback and rate limiting
 */

// Log redaction lives in @revealui/security — import `redactLogContext`
// (recursive walker) or `redactLogField` (single key/value).

import { createLogger } from '@revealui/core/observability/logger';
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
import {
  defaultBaseURLForProvider,
  defaultModelForProvider,
  isGroqCatalogModel,
  type LLMProviderType,
  resolveInferenceRoute,
} from './inference-route.js';
import { applyLocalAiProfileToEnv } from './local-ai-profile.js';
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
import { GroqProvider, type GroqProviderConfig } from './providers/groq.js';
import {
  InferenceSnapsProvider,
  type InferenceSnapsProviderConfig,
} from './providers/inference-snaps.js';
import { OllamaProvider, type OllamaProviderConfig } from './providers/ollama.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './providers/openai.js';
import { type OpenAICompatConfig, OpenAICompatProvider } from './providers/openai-compat.js';
import { XaiProvider, type XaiProviderConfig } from './providers/xai.js';
import { type CacheStats, ResponseCache, type ResponseCacheOptions } from './response-cache.js';
import type { SemanticCache, SemanticCacheOptions, SemanticCacheStats } from './semantic-cache.js';
import { estimateRequest as _estimateRequestTokens } from './token-counter.js';

export type { InferenceRoute, InferenceRouteInput, LLMProviderType } from './inference-route.js';
export {
  defaultBaseURLForProvider,
  defaultModelForProvider,
  GROQ_DEFAULT_BASE_URL,
  GROQ_DEFAULT_MODEL,
  groqAcceptedModel,
  isGroqCatalogModel,
  resolveInferenceRoute,
  resolveModelForProvider,
} from './inference-route.js';

/**
 * Providers reachable from a hosted (serverless) deployment. Localhost-only
 * providers are false. Consumed by PR-2/PR-3 (resolver + settings UI) to pick
 * which providers a hosted account may configure; no runtime consumer yet.
 */
export const hostedViable: Record<LLMProviderType, boolean> = {
  anthropic: true,
  openai: true,
  groq: true,
  huggingface: true,
  ollama: false,
  'inference-snaps': false,
  xai: true,
};

/** True when the provider can serve a hosted (serverless) deployment. */
export function isHostedViable(provider: LLMProviderType): boolean {
  return hostedViable[provider];
}

/** Emitted once per process when the zero-config localhost default is selected. */
let warnedLocalhostDefault = false;
const envFactoryLogger = createLogger({ component: 'createLLMClientFromEnv' });

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
  private semanticCacheLoading?: Promise<SemanticCache>;
  private healthMonitor?: ProviderHealthMonitor;
  private circuitBreaker: CircuitBreaker;
  private fallbackCircuitBreaker?: CircuitBreaker;
  /** Tracks the last resolved API key so we only recreate the provider when it changes */
  private currentApiKey: string;

  constructor(config: LLMClientConfig) {
    const route = resolveInferenceRoute({
      provider: config.provider,
      model: config.model,
      baseURL: config.baseURL,
      groqCredentialAvailable: config.provider === 'groq',
    });
    this.config = { ...config, ...route };
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

    // SemanticCache is loaded on first chat() when enableSemanticCache is
    // set. A static import pulls VectorMemoryService → @revealui/db/client →
    // @revealui/config, which throws REVEALUI_PUBLIC_SERVER_URL in production
    // (Apify Store 0.1.8). BYOK construction must not evaluate that graph.

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

    // Create primary provider from the resolved route (never a Groq id on OpenAI)
    this.provider = this.createProvider(this.config.provider, {
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    // Create fallback provider if specified
    if (this.config.fallbackProvider) {
      this.fallbackProvider = this.createProvider(this.config.fallbackProvider, {
        apiKey: this.config.apiKey, // Note: In practice, you'd want separate API keys
        baseURL: this.config.baseURL,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
    }
  }

  private createProvider(
    type: LLMProviderType,
    config:
      | OpenAICompatConfig
      | AnthropicProviderConfig
      | OpenAIProviderConfig
      | GroqProviderConfig
      | OllamaProviderConfig
      | InferenceSnapsProviderConfig
      | XaiProviderConfig,
  ): LLMProvider {
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider(config as AnthropicProviderConfig);
      case 'openai':
        return new OpenAIProvider(config as OpenAIProviderConfig);
      case 'groq':
        return new GroqProvider(config as GroqProviderConfig);
      case 'ollama':
        return new OllamaProvider(config as OllamaProviderConfig);
      case 'inference-snaps':
        return new InferenceSnapsProvider(config as InferenceSnapsProviderConfig);
      case 'xai':
        return new XaiProvider(config as XaiProviderConfig);
      case 'huggingface':
        // HuggingFace exposes an OpenAI-compatible inference endpoint; baseURL is
        // per-model (HF_MODEL_URL), so it has no dedicated wrapper — the compat
        // base serves it directly. Fixes the latent defect where the env factory
        // accepted 'huggingface' but createProvider threw 'Unknown provider type'.
        return new OpenAICompatProvider(config as OpenAICompatConfig);
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

  private async ensureSemanticCache(): Promise<SemanticCache | undefined> {
    if (!this.config.enableSemanticCache) {
      return undefined;
    }
    if (this.semanticCache) {
      return this.semanticCache;
    }
    if (!this.semanticCacheLoading) {
      this.semanticCacheLoading = import('./semantic-cache.js').then(({ SemanticCache }) => {
        this.semanticCache = new SemanticCache(this.config.semanticCacheOptions);
        return this.semanticCache;
      });
    }
    return this.semanticCacheLoading;
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    await this.refreshProviderIfNeeded();
    // Check semantic cache first (if enabled)
    // Semantic cache is more powerful - matches similar queries, not just exact matches
    const semanticCache = await this.ensureSemanticCache();
    if (semanticCache) {
      const query = semanticCache.extractQuery(messages);
      const cached = await semanticCache.get(query);
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
      if (semanticCache) {
        const query = semanticCache.extractQuery(messages);
        await semanticCache.set(query, response.content, response.usage);
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
    // Only the primary-provider path maps to a known LLMProviderType the health
    // monitor can key on. A dedicated embed override is an opaque provider, so we
    // skip recording rather than attribute its latency to the primary provider.
    const trackPrimary = !this.embedProviderOverride;
    const callStart = Date.now();

    try {
      this.recordRequest();
      const result = await this.circuitBreaker.execute(() => embedProvider.embed(text, options));
      if (trackPrimary) {
        this.healthMonitor?.recordCall(this.config.provider, Date.now() - callStart);
      }
      return result;
    } catch (error) {
      if (trackPrimary) {
        this.healthMonitor?.recordCall(
          this.config.provider,
          Date.now() - callStart,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      // Try fallback if available (only when using the primary provider path)
      if (!this.embedProviderOverride && this.fallbackProvider && this.config.fallbackProvider) {
        const fp = this.fallbackProvider;
        const fallbackStart = Date.now();
        try {
          const fb = this.fallbackCircuitBreaker
            ? await this.fallbackCircuitBreaker.execute(() => fp.embed(text, options))
            : await fp.embed(text, options);
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

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    await this.refreshProviderIfNeeded();
    // Note: Streaming is not cached (can't cache partial responses)
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const callStart = Date.now();
    try {
      // Circuit breaker check — streaming can't use execute() wrapper
      // so we check state and record outcomes manually
      if (this.circuitBreaker.isOpen()) {
        throw new CircuitBreakerOpenError(`llm-${this.config.provider}`);
      }
      this.recordRequest();
      // Sample health latency at time-to-first-chunk, not full stream duration:
      // a pull-based generator's total time includes downstream consumer speed,
      // which would falsely mark a healthy provider degraded.
      let sampled = false;
      for await (const chunk of this.provider.stream(messages, options)) {
        if (!sampled) {
          this.healthMonitor?.recordCall(this.config.provider, Date.now() - callStart);
          sampled = true;
        }
        yield chunk;
      }
      if (!sampled) {
        // Stream produced zero chunks but the call still succeeded.
        this.healthMonitor?.recordCall(this.config.provider, Date.now() - callStart);
      }
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
          if (this.fallbackCircuitBreaker?.isOpen()) {
            throw new CircuitBreakerOpenError(`llm-${this.config.fallbackProvider}`);
          }
          let fallbackSampled = false;
          for await (const chunk of this.fallbackProvider.stream(messages, options)) {
            if (!fallbackSampled) {
              this.healthMonitor?.recordCall(
                this.config.fallbackProvider,
                Date.now() - fallbackStart,
              );
              fallbackSampled = true;
            }
            yield chunk;
          }
          if (!fallbackSampled) {
            this.healthMonitor?.recordCall(
              this.config.fallbackProvider,
              Date.now() - fallbackStart,
            );
          }
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
 * in priority order: INFERENCE_SNAPS → GROQ → OLLAMA → ANTHROPIC_API_KEY →
 * OPENAI_API_KEY. If none are set, defaults to Inference Snaps at
 * http://localhost:9090/v1 (Ubuntu local) and emits a one-line stderr warning so
 * the implicit localhost default is discoverable in logs.
 *
 * All providers use OpenAI-compatible APIs. No proprietary provider SDKs
 * (Anthropic + OpenAI ride their OpenAI-compatible endpoints).
 *
 * Canonical Inference Snaps is the reference local provider on Ubuntu — offline,
 * silicon-optimized, no API key required. Product usage is **US-origin snaps
 * only** (gemma3 default; gemma4 and nemotron also allowlisted). See
 * `providers/us-origin-snaps.ts` and `providers/inference-snaps.ts`.
 *
 * Provider defaults:
 *   inference-snaps → gemma3   (base URL defaults to http://localhost:9090/v1)
 *   groq            → openai/gpt-oss-120b (Groq-accepted default; retired llama ids remap)
 *   ollama          → DEFAULT_DAILY_OLLAMA_MODEL (qwen2.5:3b; base URL http://localhost:11434)
 *   anthropic       → claude-sonnet-4-6 (base URL defaults to https://api.anthropic.com/v1)
 *   openai          → gpt-4o            (base URL defaults to https://api.openai.com/v1)
 *   xai             → grok-4.5          (base URL defaults to https://api.x.ai/v1)
 */
export function createLLMClientFromEnv(): LLMClient {
  // Self-host profile (idle/daily/snaps) fills missing LLM_* only; explicit env wins.
  // Hosted (VERCEL / REVEALUI_HOSTED) never loads the profile.
  applyLocalAiProfileToEnv();

  // Auto-detect provider when LLM_PROVIDER is not explicitly set. The existing
  // priority order (INFERENCE_SNAPS → GROQ → OLLAMA) is preserved so existing
  // deployments resolve identically; the frontier providers are appended after.
  let provider: LLMProviderType;
  if (process.env.LLM_PROVIDER) {
    provider = process.env.LLM_PROVIDER as LLMProviderType;
  } else if (process.env.INFERENCE_SNAPS_BASE_URL) {
    provider = 'inference-snaps';
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq';
  } else if (process.env.OLLAMA_BASE_URL) {
    provider = 'ollama';
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = 'anthropic';
  } else if (process.env.OPENAI_API_KEY) {
    provider = 'openai';
  } else if (process.env.XAI_API_KEY) {
    provider = 'xai';
  } else {
    // Zero-config Ubuntu default: assume Inference Snaps on the standard local
    // port. This localhost default is unreachable inside a hosted serverless
    // function, so warn once per process to make the implicit choice visible.
    provider = 'inference-snaps';
    if (!warnedLocalhostDefault) {
      warnedLocalhostDefault = true;
      envFactoryLogger.warn(
        'No LLM provider env var set — defaulting to inference-snaps at ' +
          'http://localhost:9090/v1. This localhost endpoint is unreachable on a ' +
          'hosted deployment; set LLM_PROVIDER or a provider key.',
      );
    }
  }

  let apiKey: string | undefined;
  let baseURL: string | undefined;
  let defaultModel: string | undefined;

  if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY;
    baseURL = process.env.ANTHROPIC_BASE_URL ?? defaultBaseURLForProvider('anthropic');
    defaultModel = defaultModelForProvider('anthropic');
  } else if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY;
    baseURL = process.env.OPENAI_BASE_URL ?? defaultBaseURLForProvider('openai');
    defaultModel = defaultModelForProvider('openai');
  } else if (provider === 'xai') {
    apiKey = process.env.XAI_API_KEY;
    baseURL = process.env.XAI_BASE_URL ?? defaultBaseURLForProvider('xai');
    defaultModel = defaultModelForProvider('xai');
  } else if (provider === 'huggingface') {
    apiKey = process.env.HF_TOKEN;
    baseURL = process.env.HF_MODEL_URL;
  } else if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY;
    baseURL = process.env.GROQ_BASE_URL ?? defaultBaseURLForProvider('groq');
    defaultModel = defaultModelForProvider('groq');
  } else if (provider === 'ollama') {
    apiKey = 'ollama'; // Ollama ignores the API key
    // Ollama's OpenAI-compatible endpoint lives at /v1
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    baseURL = ollamaBase.endsWith('/v1') ? ollamaBase : `${ollamaBase}/v1`;
    defaultModel = defaultModelForProvider('ollama');
  } else if (provider === 'inference-snaps') {
    apiKey = 'inference-snaps'; // inference-snaps ignores the API key
    // Defaults to Canonical's Inference Snap local service on port 9090; override
    // via INFERENCE_SNAPS_BASE_URL when the snap listens on a non-default port.
    // Model defaults to the US-origin allowlist default (asserted in provider ctor).
    baseURL = process.env.INFERENCE_SNAPS_BASE_URL ?? defaultBaseURLForProvider('inference-snaps');
    defaultModel = defaultModelForProvider('inference-snaps');
  }

  const route = resolveInferenceRoute({
    provider,
    model: process.env.LLM_MODEL ?? defaultModel,
    baseURL,
    groqCredentialAvailable: Boolean(process.env.GROQ_API_KEY),
  });

  if (route.provider === 'groq' && provider !== 'groq') {
    apiKey = process.env.GROQ_API_KEY;
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider "${route.provider}". Set the corresponding env var ` +
        `(INFERENCE_SNAPS_BASE_URL, GROQ_API_KEY, OLLAMA_BASE_URL, HF_TOKEN, ` +
        `ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY).`,
    );
  }

  return new LLMClient({
    provider: route.provider,
    apiKey,
    baseURL: route.baseURL,
    model: route.model,
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
 * Looks up the user's preferred provider from `tenant_provider_configs`.
 * If that provider has no saved key, uses another saved key (hosted-viable
 * when `opts.hostedViableOnly` is set — e.g. a saved Groq key). Decrypts
 * with AES-256-GCM and returns a configured LLMClient whose model and
 * base URL match the **key's** provider, never a stale preferred-provider
 * model (a Groq id must not be sent to OpenAI).
 *
 * Returns `null` if the user has no stored keys (callers should fall back
 * to `createLLMClientFromEnv()` or return a 402/feature-unavailable error).
 *
 * When `opts.hostedViableOnly` is set, a stored key whose provider is not
 * hosted-viable (ollama / inference-snaps are localhost-only) resolves to
 * `null` instead of a client. The resolver passes this on hosted deployments so
 * a localhost-only BYOK key can never yield a localhost client — the exact
 * silent-localhost defect GAP-360 closes (spec §6.5, fail-closed).
 *
 * @param userId - The user's ID from the `users` table
 * @param db - A Drizzle NeonDB client instance
 */
export async function createLLMClientForUser(
  userId: string,
  db: Database,
  // Only `append` is used; the narrow type lets a persistent store whose entry
  // type widens eventType/severity to `string` (e.g. DrizzleAuditStore) fit.
  auditStore?: Pick<AuditStore, 'append'>,
  opts?: { hostedViableOnly?: boolean },
): Promise<LLMClient | null> {
  // Find the user's preferred provider config
  const [preferredConfig] = await db
    .select()
    .from(tenantProviderConfigs)
    .where(and(eq(tenantProviderConfigs.userId, userId), eq(tenantProviderConfigs.isDefault, true)))
    .limit(1);

  // All of this user's keys. Preferred provider wins when it has a key;
  // otherwise use another saved key (hosted-viable on hosted).
  const keyRows = await db.select().from(userApiKeys).where(eq(userApiKeys.userId, userId));

  const preferredKey = preferredConfig
    ? keyRows.find((row) => row.provider === preferredConfig.provider)
    : undefined;
  const groqKey = keyRows.find((row) => row.provider === 'groq');
  const fallbackKey = keyRows.find((row) => {
    if (opts?.hostedViableOnly && !isHostedViable(row.provider as LLMProviderType)) {
      return false;
    }
    return true;
  });
  const preferredModel = preferredConfig?.model ?? undefined;
  const groqModelSelected = Boolean(preferredModel && isGroqCatalogModel(preferredModel));
  const keyRow = groqModelSelected && groqKey ? groqKey : (preferredKey ?? fallbackKey);

  if (!keyRow) return null;

  const provider = keyRow.provider as LLMProviderType;

  // Fail-closed hosted filter (§6.5): reject a localhost-only provider before
  // decrypting, so no plaintext is touched for a key we will not use.
  if (opts?.hostedViableOnly && !isHostedViable(provider)) return null;

  const plaintext = decryptApiKey(keyRow.encryptedKey);
  const requestedModel =
    preferredConfig?.provider === provider || groqModelSelected ? preferredModel : undefined;
  const route = resolveInferenceRoute({
    provider,
    model: requestedModel,
    groqCredentialAvailable: provider === 'groq' || Boolean(groqKey),
  });

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
        payload: { userId, provider: route.provider, keyId: keyRow.id },
        policyViolations: [],
      })
      .catch(() => undefined);
  }

  return new LLMClient({
    provider: route.provider,
    apiKey: plaintext,
    model: route.model,
    baseURL: route.baseURL,
  });
}
