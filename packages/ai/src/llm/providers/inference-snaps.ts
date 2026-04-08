/**
 * Canonical Inference Snaps Provider
 *
 * Local inference via Canonical's inference-snaps OpenAI-compatible API.
 * No API key required. Zero cost, fully offline, hardware-optimized.
 *
 * Supported models (snaps):
 *   gemma3         — general LLM + vision (text/image in, text out)
 *   deepseek-r1    — reasoning LLM
 *   qwen-vl        — vision-language model (image + text)
 *   nemotron-nano  — general LLM (reasoning + non-reasoning)
 *
 * Install a model:
 *   sudo snap install gemma3
 *   gemma3 set http.port=9090   # optional: change port (default varies)
 *   gemma3 status               # shows base URL and available models
 *
 * Set env vars:
 *   INFERENCE_SNAPS_BASE_URL=http://localhost:9090/v1
 *   LLM_MODEL=gemma3            # must match the snap name / model ID
 *   LLM_EMBED_MODEL=gemma3      # optional: model for embeddings
 *
 * Docs: https://documentation.ubuntu.com/inference-snaps
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

export interface InferenceSnapsProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey?: string;
  /** Base URL of the inference-snaps service, e.g. http://localhost:9090/v1 */
  baseURL: string;
  /** Chat/vision model name — must match the snap's model ID (e.g. 'gemma3', 'deepseek-r1') */
  model?: string;
  /** Embedding model name. Defaults to the chat model when omitted. */
  embedModel?: string;
}

export class InferenceSnapsProvider implements LLMProvider {
  private inner: OpenAIProvider;
  private embedModel: string;
  private baseURL: string;

  constructor(config: InferenceSnapsProviderConfig) {
    this.baseURL = config.baseURL;
    // Use the same model for embeddings unless explicitly overridden
    this.embedModel = config.embedModel ?? config.model ?? 'gemma3';
    this.inner = new OpenAIProvider({
      ...config,
      // inference-snaps ignores the API key; OpenAI client requires a non-empty value
      apiKey: config.apiKey ?? 'inference-snaps',
      baseURL: config.baseURL,
      model: config.model ?? 'gemma3',
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
      throw new Error(`inference-snaps embeddings error: ${response.statusText}`);
    }

    type EmbedResponse = { data?: Array<{ embedding?: number[] }> };
    const data = (await response.json()) as EmbedResponse;
    const embeddings = (data.data ?? []).map((item) => {
      const vector = item.embedding ?? [];
      return { vector, dimension: vector.length, model: this.embedModel };
    });

    return Array.isArray(text) ? embeddings : (embeddings[0] as Embedding);
  }
}
