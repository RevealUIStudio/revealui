/**
 * Canonical Inference Snaps Provider
 *
 * Local inference via Canonical's inference-snaps OpenAI-compatible API.
 * No API key required. Zero cost, fully offline, hardware-optimized.
 *
 * Product hardline: US-origin snap models only (see us-origin-snaps.ts).
 * Allowlisted snaps (install these):
 *   nemotron-3-nano        -  NVIDIA general + tools (default)
 *   nemotron-3-nano-omni   -  NVIDIA multimodal
 *   gemma3 / gemma4        -  Google general + vision + tools
 *
 * Canonical also publishes non-US snaps (deepseek-r1, qwen-*, glm-*). Those
 * are rejected at construction unless REVEALUI_ALLOW_NON_US_MODELS=1.
 *
 * Install a model:
 *   sudo snap install nemotron-3-nano
 *   nemotron-3-nano set http.port=9090   # optional: change port
 *   nemotron-3-nano status              # shows base URL and available models
 *
 * Set env vars:
 *   INFERENCE_SNAPS_BASE_URL=http://localhost:9090/v1
 *   LLM_MODEL=nemotron-3-nano   # must match an allowlisted snap model ID
 *   LLM_EMBED_MODEL=nemotron-3-nano
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
  ReasonerCapabilities,
} from './base.js';
import { OpenAICompatProvider } from './openai-compat.js';
import {
  assertUsOriginInferenceSnap,
  DEFAULT_US_ORIGIN_INFERENCE_SNAP,
} from './us-origin-snaps.js';

export interface InferenceSnapsProviderConfig extends Omit<LLMProviderConfig, 'apiKey'> {
  apiKey?: string;
  /** Base URL of the inference-snaps service, e.g. http://localhost:9090/v1 */
  baseURL: string;
  /**
   * Chat/vision model name — must match an allowlisted snap model ID
   * (e.g. 'nemotron-3-nano', 'gemma4'). See US_ORIGIN_INFERENCE_SNAP_IDS.
   */
  model?: string;
  /** Embedding model name. Defaults to the chat model when omitted. */
  embedModel?: string;
  /**
   * Bypass US-origin allowlist for this instance (operator/tests only).
   * Prefer the process env REVEALUI_ALLOW_NON_US_MODELS=1 when needed.
   */
  allowNonUsModels?: boolean;
}

export class InferenceSnapsProvider implements LLMProvider {
  private inner: OpenAICompatProvider;
  private embedModel: string;
  private baseURL: string;

  constructor(config: InferenceSnapsProviderConfig) {
    this.baseURL = config.baseURL;
    const assertOpts = { allowNonUs: config.allowNonUsModels === true };
    const model = assertUsOriginInferenceSnap(config.model, assertOpts);
    this.embedModel = assertUsOriginInferenceSnap(config.embedModel ?? model, assertOpts);
    this.inner = new OpenAICompatProvider({
      ...config,
      // inference-snaps ignores the API key; OpenAI client requires a non-empty value
      apiKey: config.apiKey ?? 'inference-snaps',
      baseURL: config.baseURL,
      model,
    });
  }

  capabilities(): ReasonerCapabilities {
    // Profile for the default US-origin model (text + tools). Per-model capability
    // negotiation (e.g. nemotron-3-nano-omni vision) is a follow-up.
    return {
      providerTag: 'inference-snaps',
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

export { DEFAULT_US_ORIGIN_INFERENCE_SNAP };
