/**
 * BitNet Provider
 *
 * Local inference via BitNet's OpenAI-compatible llama-server (http://localhost:8080/v1).
 * No API key required. Runs entirely on CPU (AVX2). Zero cost, fully offline.
 *
 * Setup: pnpm bitnet:install  (clone + compile + download model)
 * Start: pnpm bitnet:serve    (start inference server on :8080)
 *
 * Note: BitNet is a generative model only. It does not expose /v1/embeddings.
 * For vector search, use Ollama (nomic-embed-text) or @xenova/transformers.
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
import { OpenAIProvider } from './openai.js';

export interface BitnetProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey?: string;
  /** Defaults to http://localhost:8080/v1 */
  baseURL?: string;
  /** Chat model. Defaults to bitnet-b1.58-2B-4T — installed by pnpm bitnet:install */
  model?: string;
}

export class BitnetProvider implements LLMProvider {
  private inner: OpenAIProvider;

  constructor(config: BitnetProviderConfig) {
    this.inner = new OpenAIProvider({
      ...config,
      // llama-server ignores the API key but the OpenAI client requires a non-empty value
      apiKey: config.apiKey ?? 'bitnet',
      baseURL: config.baseURL ?? 'http://localhost:8080/v1',
      model: config.model ?? 'bitnet-b1.58-2B-4T',
    });
  }

  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    return this.inner.chat(messages, options);
  }

  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    return this.inner.stream(messages, options);
  }

  embed(_text: string | string[], _options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    throw new Error(
      'BitNet does not support embeddings. Set OLLAMA_BASE_URL to auto-wire Ollama ' +
        '(nomic-embed-text) as the embed backend, or use @xenova/transformers for ' +
        'fully offline embedding generation.',
    );
  }
}
