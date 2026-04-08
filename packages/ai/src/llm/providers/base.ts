/**
 * LLM Provider Base Interface
 *
 * Abstract interface for all LLM providers (OpenAI, Anthropic, etc.)
 */

/**
 * A plain text content part — used in multipart messages.
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * An image content part — base64 data URL or HTTPS URL.
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
  /** Anthropic prompt caching - marks content for caching (5min TTL, 90% cost reduction) */
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
    /** Anthropic cache stats */
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
 * Base interface for LLM providers
 */
export interface LLMProvider {
  /**
   * Chat completion
   */
  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse>;

  /**
   * Generate embeddings
   */
  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]>;

  /**
   * Stream chat completion
   */
  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk>;
}

export interface LLMChatOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** Enable prompt caching (Anthropic only) - caches system prompts and tools */
  enableCache?: boolean;
  /**
   * Extended thinking token budget (Anthropic only).
   * Enables Claude's internal reasoning before responding.
   * Typical values: 512 (minimal) → 31999 (xhigh). 0 or undefined = disabled.
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
  /** Enable prompt caching (Anthropic only) - caches system prompts and tools */
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
