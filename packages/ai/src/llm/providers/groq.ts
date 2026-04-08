/**
 * Groq Provider
 *
 * Thin wrapper over OpenAIProvider using Groq's OpenAI-compatible API.
 * Free tier: 6,000 TPM / 500k TPD for Llama 3.3 70B.
 * Sign up: console.groq.com
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
} from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';

export interface GroqProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey: string;
  /** Defaults to https://api.groq.com/openai/v1 */
  baseURL?: string;
  /** Defaults to llama-3.3-70b-versatile */
  model?: string;
}

export class GroqProvider implements LLMProvider {
  private inner: OpenAICompatProvider;

  constructor(config: GroqProviderConfig) {
    this.inner = new OpenAICompatProvider({
      ...config,
      baseURL: config.baseURL ?? 'https://api.groq.com/openai/v1',
      model: config.model ?? 'llama-3.3-70b-versatile',
    });
  }

  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    return this.inner.chat(messages, options);
  }

  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    return this.inner.stream(messages, options);
  }

  embed(_text: string | string[], _options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    throw new Error('Groq does not support embeddings. Use Ollama or HuggingFace.');
  }
}
