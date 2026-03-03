/**
 * Unified LLM Client
 *
 * Single interface for all LLM providers with fallback and rate limiting
 */

import type { Database } from '@revealui/db/client'
import { decryptApiKey } from '@revealui/db/crypto'
import { tenantProviderConfigs, userApiKeys } from '@revealui/db/schema'
import { and, eq } from 'drizzle-orm'
import { AnthropicProvider, type AnthropicProviderConfig } from './providers/anthropic.js'
import type {
  Embedding,
  LLMChatOptions,
  LLMChunk,
  LLMEmbedOptions,
  LLMProvider,
  LLMResponse,
  LLMStreamOptions,
  Message,
} from './providers/base.js'
import { GroqProvider, type GroqProviderConfig } from './providers/groq.js'
import { OllamaProvider, type OllamaProviderConfig } from './providers/ollama.js'
import { OpenAIProvider, type OpenAIProviderConfig } from './providers/openai.js'
import { VultrProvider, type VultrProviderConfig } from './providers/vultr.js'
import { type CacheStats, ResponseCache, type ResponseCacheOptions } from './response-cache.js'
import {
  SemanticCache,
  type SemanticCacheOptions,
  type SemanticCacheStats,
} from './semantic-cache.js'

export type LLMProviderType = 'openai' | 'anthropic' | 'vultr' | 'groq' | 'ollama' | 'huggingface'

export interface LLMClientConfig {
  provider: LLMProviderType
  apiKey: string
  baseURL?: string
  model?: string
  temperature?: number
  maxTokens?: number
  fallbackProvider?: LLMProviderType
  rateLimit?: {
    requestsPerMinute?: number
    requestsPerDay?: number
  }
  /** Enable Anthropic prompt caching by default (90% cost reduction on cache hits) */
  enableCacheByDefault?: boolean
  /** Enable response caching (100% cost savings on duplicate requests) */
  enableResponseCache?: boolean
  /** Response cache options */
  responseCacheOptions?: ResponseCacheOptions
  /** Enable semantic caching (73% cost reduction, 65% hit rate) */
  enableSemanticCache?: boolean
  /** Semantic cache options */
  semanticCacheOptions?: SemanticCacheOptions
}

interface RateLimitState {
  requests: number[]
  dailyRequests: number
  lastReset: number
}

export class LLMClient {
  private provider: LLMProvider
  private fallbackProvider?: LLMProvider
  private config: LLMClientConfig
  private rateLimitState: RateLimitState
  private responseCache?: ResponseCache
  private semanticCache?: SemanticCache

  constructor(config: LLMClientConfig) {
    this.config = config
    this.rateLimitState = {
      requests: [],
      dailyRequests: 0,
      lastReset: Date.now(),
    }

    // Initialize response cache if enabled
    if (config.enableResponseCache) {
      this.responseCache = new ResponseCache(config.responseCacheOptions)
    }

    // Initialize semantic cache if enabled
    if (config.enableSemanticCache) {
      this.semanticCache = new SemanticCache(config.semanticCacheOptions)
    }

    // Create primary provider
    this.provider = this.createProvider(config.provider, {
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    })

    // Create fallback provider if specified
    if (config.fallbackProvider) {
      this.fallbackProvider = this.createProvider(config.fallbackProvider, {
        apiKey: config.apiKey, // Note: In practice, you'd want separate API keys
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      })
    }
  }

  private createProvider(
    type: LLMProviderType,
    config:
      | OpenAIProviderConfig
      | AnthropicProviderConfig
      | VultrProviderConfig
      | GroqProviderConfig
      | OllamaProviderConfig,
  ): LLMProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config as OpenAIProviderConfig)
      case 'anthropic':
        return new AnthropicProvider({
          ...(config as AnthropicProviderConfig),
          enableCacheByDefault: this.config.enableCacheByDefault,
        })
      case 'vultr':
        return new VultrProvider(config as VultrProviderConfig)
      case 'groq':
        return new GroqProvider(config as GroqProviderConfig)
      case 'ollama':
        return new OllamaProvider(config as OllamaProviderConfig)
      default:
        throw new Error(`Unknown provider type: ${String(type)}`)
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now()
    const { rateLimit } = this.config

    if (!rateLimit) {
      return true
    }

    // Reset daily counter if needed
    if (now - this.rateLimitState.lastReset > 24 * 60 * 60 * 1000) {
      this.rateLimitState.dailyRequests = 0
      this.rateLimitState.lastReset = now
    }

    // Check per-minute limit
    if (rateLimit.requestsPerMinute) {
      const oneMinuteAgo = now - 60 * 1000
      this.rateLimitState.requests = this.rateLimitState.requests.filter(
        (time) => time > oneMinuteAgo,
      )

      if (this.rateLimitState.requests.length >= rateLimit.requestsPerMinute) {
        return false
      }
    }

    // Check daily limit
    if (rateLimit.requestsPerDay) {
      if (this.rateLimitState.dailyRequests >= rateLimit.requestsPerDay) {
        return false
      }
    }

    return true
  }

  private recordRequest(): void {
    const now = Date.now()
    this.rateLimitState.requests.push(now)
    this.rateLimitState.dailyRequests++
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    // Check semantic cache first (if enabled)
    // Semantic cache is more powerful - matches similar queries, not just exact matches
    if (this.semanticCache) {
      const query = this.semanticCache.extractQuery(messages)
      const cached = await this.semanticCache.get(query)
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
        }
      }
    }

    // Check response cache (if enabled and semantic cache didn't hit)
    if (this.responseCache) {
      const cacheKey = this.responseCache.getCacheKey(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        tools: options?.tools,
        model: this.config.model,
      })

      const cached = this.responseCache.get(cacheKey)
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
        }
      }

      // Cache miss - proceed with API call
    }

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded')
    }

    try {
      this.recordRequest()
      const response = await this.provider.chat(messages, options)

      // Store in semantic cache (if enabled)
      if (this.semanticCache) {
        const query = this.semanticCache.extractQuery(messages)
        await this.semanticCache.set(query, response.content, response.usage)
      }

      // Store in response cache (if enabled)
      if (this.responseCache) {
        const cacheKey = this.responseCache.getCacheKey(messages, {
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          tools: options?.tools,
          model: this.config.model,
        })

        this.responseCache.set(cacheKey, {
          content: response.content,
          role: response.role,
          finishReason: response.finishReason,
          toolCalls: response.toolCalls,
          timestamp: Date.now(),
          usage: response.usage,
        })
      }

      return response
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        try {
          return await this.fallbackProvider.chat(messages, options)
        } catch {
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
      throw error
    }
  }

  async embed(
    text: string | string[],
    options?: LLMEmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded')
    }

    try {
      this.recordRequest()
      return await this.provider.embed(text, options)
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        try {
          return await this.fallbackProvider.embed(text, options)
        } catch {
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
      throw error
    }
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    // Note: Streaming is not cached (can't cache partial responses)
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded')
    }

    try {
      this.recordRequest()
      yield* this.provider.stream(messages, options)
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        try {
          yield* this.fallbackProvider.stream(messages, options)
        } catch {
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Get response cache statistics
   *
   * @returns Cache stats or undefined if caching is disabled
   */
  getResponseCacheStats(): CacheStats | undefined {
    return this.responseCache?.getStats()
  }

  /**
   * Clear response cache
   */
  clearResponseCache(): void {
    this.responseCache?.clear()
  }

  /**
   * Get semantic cache statistics
   *
   * @returns Semantic cache stats or undefined if caching is disabled
   */
  getSemanticCacheStats(): SemanticCacheStats | undefined {
    return this.semanticCache?.getStats()
  }

  /**
   * Clear semantic cache
   */
  clearSemanticCache(): void {
    this.semanticCache?.resetStats()
  }
}

/**
 * Create an LLM client from environment variables.
 *
 * When LLM_PROVIDER is not set, auto-detects the provider by checking env vars
 * in priority order: ANTHROPIC_API_KEY → OPENAI_API_KEY → GROQ_API_KEY → OLLAMA_BASE_URL.
 *
 * Provider defaults:
 *   groq   → llama-3.3-70b-versatile
 *   ollama → llama3.2:3b
 *   openai → gpt-4o-mini (OpenAIProvider default)
 */
export function createLLMClientFromEnv(): LLMClient {
  // Auto-detect provider when LLM_PROVIDER is not explicitly set
  let provider: LLMProviderType
  if (process.env.LLM_PROVIDER) {
    provider = process.env.LLM_PROVIDER as LLMProviderType
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = 'anthropic'
  } else if (process.env.OPENAI_API_KEY) {
    provider = 'openai'
  } else if (process.env.GROQ_API_KEY) {
    provider = 'groq'
  } else if (process.env.OLLAMA_BASE_URL) {
    provider = 'ollama'
  } else {
    provider = 'openai' // will throw below due to missing key
  }

  let apiKey: string | undefined
  let baseURL: string | undefined
  let defaultModel: string | undefined

  if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY
    baseURL = process.env.OPENAI_BASE_URL
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY
    baseURL = process.env.ANTHROPIC_BASE_URL
  } else if (provider === 'vultr') {
    apiKey = process.env.VULTR_API_KEY
    baseURL = process.env.VULTR_BASE_URL
  } else if (provider === 'huggingface') {
    apiKey = process.env.HF_TOKEN
    baseURL = process.env.HF_MODEL_URL
  } else if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY
    baseURL = process.env.GROQ_BASE_URL
    defaultModel = 'llama-3.3-70b-versatile'
  } else if (provider === 'ollama') {
    apiKey = 'ollama' // Ollama ignores the API key
    baseURL = process.env.OLLAMA_BASE_URL
    defaultModel = 'llama3.2:3b'
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider "${provider}". Set the corresponding env var ` +
        `(ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY) or OLLAMA_BASE_URL for local inference.`,
    )
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
  })
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
): Promise<LLMClient | null> {
  // Find the user's preferred provider config
  const [preferredConfig] = await db
    .select()
    .from(tenantProviderConfigs)
    .where(and(eq(tenantProviderConfigs.userId, userId), eq(tenantProviderConfigs.isDefault, true)))
    .limit(1)

  // Find the matching API key (preferred provider, or any available key)
  const keyQuery = db
    .select()
    .from(userApiKeys)
    .where(
      preferredConfig
        ? and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, preferredConfig.provider))
        : eq(userApiKeys.userId, userId),
    )
    .limit(1)

  const [keyRow] = await keyQuery

  if (!keyRow) return null

  const plaintext = decryptApiKey(keyRow.encryptedKey)
  const provider = keyRow.provider as LLMProviderType
  const model = preferredConfig?.model ?? undefined

  return new LLMClient({ provider, apiKey: plaintext, model })
}
