/**
 * Anthropic Provider
 *
 * Thin wrapper over OpenAICompatProvider using Anthropic's OpenAI-compatible
 * surface at https://api.anthropic.com/v1. No proprietary Anthropic SDK — the
 * fleet posture is "No proprietary provider SDKs" (see client.ts). Anthropic
 * exposes an OpenAI-compatible chat/completions endpoint, so the same base
 * implementation that serves Groq/Ollama/inference-snaps serves Anthropic too.
 *
 * Docs: https://docs.anthropic.com/en/api/openai-sdk
 */

import type {
  Embedding,
  LLMChatOptions,
  LLMChunk,
  LLMEmbedOptions,
  LLMProvider,
  LLMProviderConfig,
  LLMResponse,
  LLMStreamOptions,
  Message,
  ReasonerCapabilities,
} from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';

export interface AnthropicProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey: string;
  /** Defaults to https://api.anthropic.com/v1 */
  baseURL?: string;
  /** Defaults to claude-sonnet-4-6 (conservative documented default; overridable) */
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class AnthropicProvider implements LLMProvider {
  private inner: OpenAICompatProvider;

  constructor(config: AnthropicProviderConfig) {
    this.inner = new OpenAICompatProvider({
      ...config,
      baseURL: config.baseURL ?? 'https://api.anthropic.com/v1',
      model: config.model ?? 'claude-sonnet-4-6',
    });
  }

  capabilities(): ReasonerCapabilities {
    return {
      providerTag: 'anthropic',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      // Anthropic exposes no embeddings endpoint on its OpenAI-compat surface.
      embeddings: false,
      reasoningEffort: false,
      promptCache: false,
      structuredOutput: false,
    };
  }

  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    return this.inner.chat(messages, options);
  }

  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    return this.inner.stream(messages, options);
  }

  embed(_text: string | string[], _options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    throw new Error('Anthropic does not expose an embeddings endpoint. Use OpenAI or Ollama.');
  }
}
