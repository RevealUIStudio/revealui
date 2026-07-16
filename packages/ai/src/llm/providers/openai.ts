/**
 * OpenAI Provider
 *
 * Thin wrapper over OpenAICompatProvider targeting OpenAI's native
 * chat/completions + embeddings API at https://api.openai.com/v1. OpenAI is the
 * reference OpenAI-compatible surface, so the shared base implementation serves
 * it directly — no proprietary SDK (fleet posture in client.ts).
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

export interface OpenAIProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey: string;
  /** Defaults to https://api.openai.com/v1 */
  baseURL?: string;
  /** Defaults to gpt-4o (conservative documented default; overridable) */
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class OpenAIProvider implements LLMProvider {
  private inner: OpenAICompatProvider;

  constructor(config: OpenAIProviderConfig) {
    this.inner = new OpenAICompatProvider({
      ...config,
      baseURL: config.baseURL ?? 'https://api.openai.com/v1',
      model: config.model ?? 'gpt-4o',
    });
  }

  capabilities(): ReasonerCapabilities {
    return {
      providerTag: 'openai',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      embeddings: true,
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

  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    return this.inner.embed(text, options);
  }
}
