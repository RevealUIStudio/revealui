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

  constructor(config: LLMClientConfig) {
    this.config = config
    this.rateLimitState = {
      requests: [],
      dailyRequests: 0,
      lastReset: Date.now(),
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
    config: OpenAIProviderConfig | AnthropicProviderConfig,
  ): LLMProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config as OpenAIProviderConfig)
      case 'anthropic':
        return new AnthropicProvider(config as AnthropicProviderConfig)
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
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded')
    }

    try {
      this.recordRequest()
      return await this.provider.chat(messages, options)
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
}

/**
 * Create an LLM client from environment variables
 */
export function createLLMClientFromEnv(): LLMClient {
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProviderType
  let apiKey: string | undefined
  let baseURL: string | undefined

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
  }

  if (!apiKey) {
    throw new Error(
      `API key not found for provider ${provider}. Set the corresponding API key env var (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, or VULTR_API_KEY).`,
    )
  }

  return new LLMClient({
    provider,
    apiKey,
    model: process.env.LLM_MODEL,
    temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : undefined,
  })
}
