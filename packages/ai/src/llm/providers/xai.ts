/**
 * xAI (Grok) Provider
 *
 * Thin wrapper over OpenAICompatProvider using xAI's OpenAI-compatible
 * surface at https://api.x.ai/v1. No proprietary xAI SDK — the fleet posture
 * is "No proprietary provider SDKs" (see client.ts). BYOK only: the user
 * brings their own xAI API key, RevealUI never hosts one.
 *
 * Docs: https://docs.x.ai/developers/grok-4-5
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

export interface XaiProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey: string;
  /** Defaults to https://api.x.ai/v1 */
  baseURL?: string;
  /** Defaults to grok-4.5 */
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class XaiProvider implements LLMProvider {
  private inner: OpenAICompatProvider;

  constructor(config: XaiProviderConfig) {
    this.inner = new OpenAICompatProvider({
      ...config,
      baseURL: config.baseURL ?? 'https://api.x.ai/v1',
      model: config.model ?? 'grok-4.5',
    });
  }

  capabilities(): ReasonerCapabilities {
    return {
      providerTag: 'xai',
      tools: true,
      parallelToolCalls: false,
      vision: false,
      streaming: true,
      // xAI exposes no embeddings endpoint on its OpenAI-compat surface.
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
    throw new Error('xAI does not expose an embeddings endpoint. Use OpenAI or Ollama.');
  }
}
