/**
 * Ollama Provider
 *
 * Local inference via Ollama's OpenAI-compatible API (http://localhost:11434/v1).
 * No API key required. Zero cost, fully offline.
 * Install: https://ollama.com
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

export interface OllamaProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey?: string;
  /** Defaults to http://localhost:11434/v1 */
  baseURL?: string;
  /** Chat model. Defaults to gemma4:e2b  -  run `ollama pull gemma4:e2b` first */
  model?: string;
  /** Embedding model. Defaults to nomic-embed-text  -  run `ollama pull nomic-embed-text` first */
  embedModel?: string;
}

export class OllamaProvider implements LLMProvider {
  private inner: OpenAICompatProvider;
  private embedModel: string;
  private baseURL: string;

  constructor(config: OllamaProviderConfig) {
    const baseURL = config.baseURL ?? 'http://localhost:11434/v1';
    this.baseURL = baseURL;
    this.embedModel = config.embedModel ?? 'nomic-embed-text';
    this.inner = new OpenAICompatProvider({
      ...config,
      // Ollama ignores the API key but the OpenAI client requires a non-empty value
      apiKey: config.apiKey ?? 'ollama',
      baseURL,
      model: config.model ?? 'gemma4:e2b',
    });
  }

  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    return this.inner.chat(messages, options);
  }

  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    return this.inner.stream(messages, options);
  }

  async embed(
    text: string | string[],
    _options?: LLMEmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    const texts = Array.isArray(text) ? text : [text];

    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embedModel, input: texts }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings error: ${response.statusText}`);
    }

    type OllamaEmbedResponse = { data?: Array<{ embedding?: number[] }> };
    const data = (await response.json()) as OllamaEmbedResponse;
    const embeddings = (data.data ?? []).map((item) => {
      const vector = item.embedding ?? [];
      return { vector, dimension: vector.length, model: this.embedModel };
    });

    return Array.isArray(text) ? embeddings : (embeddings[0] as Embedding);
  }
}
