/**
 * LLM Provider Base Interface
 *
 * Abstract interface for all LLM providers (OpenAI, Anthropic, etc.)
 */

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMResponse {
  content: string
  role: 'assistant'
  toolCalls?: ToolCall[]
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter'
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface Embedding {
  vector: number[]
  dimension: number
  model: string
}

export interface LLMChunk {
  content: string
  done: boolean
  toolCalls?: ToolCall[]
}

export interface LLMProviderConfig {
  apiKey: string
  baseURL?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Base interface for LLM providers
 */
export interface LLMProvider {
  /**
   * Chat completion
   */
  chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse>

  /**
   * Generate embeddings
   */
  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]>

  /**
   * Stream chat completion
   */
  stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk>
}

export interface LLMChatOptions {
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
}

export interface LLMEmbedOptions {
  model?: string
}

export interface LLMStreamOptions {
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
