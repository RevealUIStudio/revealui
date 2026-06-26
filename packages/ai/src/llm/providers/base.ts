/**
 * LLM Provider Base Interface
 *
 * The agnostic Reasoner port (ADR 2026-06-25). Providers are negotiated by
 * `capabilities()`, never by provider-name string. Vendor-shaped request knobs are
 * tagged `@deprecated PROVIDER-EXTENSION` and excluded from the agnostic conformance
 * contract; cross-provider usage (e.g. cache token stats) stays neutral.
 */

/**
 * A plain text content part  -  used in multipart messages.
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * An image content part  -  base64 data URL or HTTPS URL.
 * Supported by OpenAI-compatible providers (inference-snaps, Ollama vision, GPT-4o).
 *
 * @example
 * { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
 */
export interface ImagePart {
  type: 'image_url';
  image_url: {
    /** Base64 data URL (data:image/jpeg;base64,...) or HTTPS image URL */
    url: string;
    /** Resolution hint for the model. Defaults to 'auto'. */
    detail?: 'low' | 'high' | 'auto';
  };
}

/** Union of all content part types for multipart messages. */
export type ContentPart = TextPart | ImagePart;

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Plain text or multipart content (text + images). Arrays are passed through
   *  to OpenAI-compatible providers as-is; other providers receive text parts only. */
  content: string | ContentPart[];
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  /**
   * Neutral cache breakpoint hint (gated by the `promptCache` capability). An adapter
   * that supports prompt caching maps this to its native cache-control; others ignore it.
   */
  cache?: boolean;
  /**
   * @deprecated PROVIDER-EXTENSION  -  use `cache`. Anthropic-shaped request knob, retained
   * transitionally for the cache-helper layer; excluded from the agnostic conformance
   * contract. Callers migrate in P1b, then this is removed.
   */
  cacheControl?: { type: 'ephemeral' };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string;
  role: 'assistant';
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /**
     * Cross-provider cache usage (neutral; gated by `promptCache`). Populated by any
     * caching provider  -  Anthropic cache tokens, OpenAI `cached_tokens`, Gemini
     * `cachedContentTokenCount`. Read by the cost path; stays in neutral `usage`.
     */
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
}

export interface Embedding {
  vector: number[];
  dimension: number;
  model: string;
}

export interface LLMChunk {
  content: string;
  done: boolean;
  toolCalls?: ToolCall[];
}

export interface LLMProviderConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Reasoning-depth hint (neutral, capability-gated by `reasoningEffort`).
 *
 * This is a *reasoning-depth* axis, NOT output entropy or length  -  adapters must never
 * remap it to `temperature`/`maxTokens`. An adapter with a reasoning axis maps it to its
 * native control (e.g. a thinking-token budget); an adapter without one advertises
 * `reasoningEffort: false` and treats `effort` as a no-op.
 */
export type ReasoningEffort = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Runtime-queryable capability record. The loop branches on these, never on a
 * provider-name string. Conformance-tested (transport tier) so a provider cannot lie:
 * advertise-true-but-not-wired fails the positive assertion; advertise-false-but-emits-a-
 * native-field fails the inertness assertion.
 */
export interface ReasonerCapabilities {
  /** Stable adapter id; also the only `providerOptions` namespace this adapter may read ('x-<tag>'). */
  readonly providerTag: string;
  readonly tools: boolean;
  /** Implies `tools` (consistency invariant). */
  readonly parallelToolCalls: boolean;
  /** Implies the adapter accepts `ContentPart[]` message content. */
  readonly vision: boolean;
  readonly streaming: boolean;
  readonly embeddings: boolean;
  readonly reasoningEffort: boolean;
  readonly promptCache: boolean;
  readonly structuredOutput: boolean;
  /** Max context window in tokens; undefined = unknown (loop budgets conservatively). */
  readonly contextWindow?: number;
}

/**
 * Namespaced opaque extension for genuinely unportable, request-shaped knobs.
 *
 * Core/loop code MUST pass this through and MUST NOT read any key  -  per-namespace schema
 * lives in the owning adapter. A known-namespace registry (typed keys) rather than a bare
 * `x-*` string convention, so a typo'd namespace fails loudly instead of silently no-opping.
 */
export interface ProviderOptions {
  'x-anthropic'?: unknown;
  'x-openai'?: unknown;
  'x-google'?: unknown;
}

/**
 * The Reasoner port  -  one swappable reasoning step plus the side capabilities
 * (embeddings/streaming). The loop negotiates by `capabilities()`, never by name.
 */
export interface Reasoner {
  /** Runtime-queryable, conformance-tested capability record. */
  capabilities(): ReasonerCapabilities;

  /** Chat completion. */
  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse>;

  /** Generate embeddings. */
  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]>;

  /** Stream chat completion. */
  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk>;
}

/**
 * @deprecated Use `Reasoner`. Alias retained one release cycle for external callers.
 */
export type LLMProvider = Reasoner;

export interface LLMChatOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** Neutral reasoning-depth hint (gated by `reasoningEffort`). No-op where unsupported. */
  effort?: ReasoningEffort;
  /** Neutral prompt-cache hint for the stable prefix  -  system + tools (gated by `promptCache`). */
  cacheHint?: boolean;
  /** Opaque, namespaced provider extension. Core never reads it; the adapter owns the schema. */
  providerOptions?: ProviderOptions;
  /**
   * @deprecated PROVIDER-EXTENSION  -  use `cacheHint`. Excluded from the agnostic
   * conformance contract; callers migrate in P1b, then this is removed.
   */
  enableCache?: boolean;
  /**
   * @deprecated PROVIDER-EXTENSION  -  use `effort`. Vendor-shaped token budget; no provider
   * reads it. Excluded from the agnostic conformance contract; callers migrate in P1b.
   */
  thinkingBudget?: number;
}

export interface LLMEmbedOptions {
  model?: string;
}

export interface LLMStreamOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** Neutral reasoning-depth hint (gated by `reasoningEffort`). No-op where unsupported. */
  effort?: ReasoningEffort;
  /** Opaque, namespaced provider extension. Core never reads it; the adapter owns the schema. */
  providerOptions?: ProviderOptions;
  /**
   * @deprecated PROVIDER-EXTENSION  -  use the `promptCache` capability + `cacheHint` on chat.
   * Callers migrate in P1b, then this is removed.
   */
  enableCache?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';
