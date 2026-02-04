/**
 * Unified LLM Client
 *
 * Single interface for all LLM providers with fallback and rate limiting
 */

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
import { OpenAIProvider, type OpenAIProviderConfig } from './providers/openai.js'
import {
  ResponseCache,
  type ResponseCacheOptions,
  type CacheStats,
} from './response-cache.js'
import { VultrProvider, type VultrProviderConfig } from './providers/vultr.js'

export type LLMProviderType = 'openai' | 'anthropic' | 'vultr'

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
    config: OpenAIProviderConfig | AnthropicProviderConfig | VultrProviderConfig,
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
    // Check response cache first (if enabled)
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

      // Store in response cache
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
}

/**
 * Create an LLM client from environment variables
 */
export function createLLMClientFromEnv(): LLMClient {
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProviderType
  let apiKey: string | undefined
  let _baseURL: string | undefined

  if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY
    _baseURL = process.env.OPENAI_BASE_URL
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY
    _baseURL = process.env.ANTHROPIC_BASE_URL
  } else if (provider === 'vultr') {
    apiKey = process.env.VULTR_API_KEY
    _baseURL = process.env.VULTR_BASE_URL
  } else if (provider === 'huggingface') {
    apiKey = process.env.HF_TOKEN
    _baseURL = process.env.HF_MODEL_URL
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider ${provider}. Set the corresponding API key env var (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, or VULTR_API_KEY).`,
    )
  }

  // Base URL is optional - providers have sensible defaults

  return new LLMClient({
    provider,
    apiKey,
    model: process.env.LLM_MODEL,
    temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : undefined,
    enableCacheByDefault:
      process.env.LLM_ENABLE_CACHE === 'true' || process.env.ANTHROPIC_ENABLE_CACHE === 'true',
    enableResponseCache:
      process.env.LLM_ENABLE_RESPONSE_CACHE === 'true' ||
      process.env.RESPONSE_CACHE_ENABLED === 'true',
  })
}
