/**
 * Anthropic Provider
 *
 * Implementation of LLMProvider for Anthropic Claude API
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
  ToolCall,
} from './base.js'

export interface AnthropicProviderConfig extends LLMProviderConfig {
  apiVersion?: string
}

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AnthropicTextBlock = {
  type: 'text'
  text: string
}

type AnthropicToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | { type: string; [key: string]: unknown }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTextBlock = (block: AnthropicContentBlock): block is AnthropicTextBlock =>
  block.type === 'text' && typeof (block as AnthropicTextBlock).text === 'string'

const isToolUseBlock = (block: AnthropicContentBlock): block is AnthropicToolUseBlock =>
  block.type === 'tool_use'

const maxTokensKey = 'max_tokens' as const
const inputTokensKey = 'input_tokens' as const
const outputTokensKey = 'output_tokens' as const
const stopReasonKey = 'stop_reason' as const

export class AnthropicProvider implements LLMProvider {
  private config: AnthropicProviderConfig
  private baseURL: string

  constructor(config: AnthropicProviderConfig) {
    this.config = config
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1'
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    // Anthropic API format is slightly different
    const systemMessages = messages.filter((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.apiVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        system: systemMessages.map((m) => m.content).join('\n'),
        messages: this.formatMessages(conversationMessages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        tools: options?.tools,
      }),
    })

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown
      const errorMessage =
        isRecord(errorPayload) &&
        isRecord(errorPayload.error) &&
        typeof errorPayload.error.message === 'string'
          ? errorPayload.error.message
          : response.statusText
      throw new Error(`Anthropic API error: ${errorMessage}`)
    }

    const data = (await response.json()) as Record<string, unknown>
    const contentBlocks = Array.isArray(data.content)
      ? (data.content as AnthropicContentBlock[])
      : []
    const textBlock = contentBlocks.find(isTextBlock)
    const toolCalls: ToolCall[] | undefined = contentBlocks.filter(isToolUseBlock).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.input),
      },
    }))
    const usage =
      data.usage && typeof data.usage === 'object'
        ? (data.usage as Record<string, unknown>)
        : undefined
    const inputTokens =
      usage && typeof usage[inputTokensKey] === 'number' ? usage[inputTokensKey] : undefined
    const outputTokens =
      usage && typeof usage[outputTokensKey] === 'number' ? usage[outputTokensKey] : undefined
    const finishReason =
      typeof data[stopReasonKey] === 'string'
        ? (data[stopReasonKey] as LLMResponse['finishReason'])
        : undefined

    return {
      content: textBlock?.text || '',
      role: 'assistant',
      toolCalls,
      finishReason,
      usage:
        inputTokens !== undefined && outputTokens !== undefined
          ? {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            }
          : undefined,
    }
  }

  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    void text
    void options
    // Anthropic doesn't have a separate embeddings API
    // Would need to use a different provider or service
    return Promise.reject(
      new Error('Anthropic does not support embeddings. Use OpenAI provider for embeddings.'),
    )
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    const systemMessages = messages.filter((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.apiVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        system: systemMessages.map((m) => m.content).join('\n'),
        messages: this.formatMessages(conversationMessages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        tools: options?.tools,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown
      const errorMessage =
        isRecord(errorPayload) &&
        isRecord(errorPayload.error) &&
        typeof errorPayload.error.message === 'string'
          ? errorPayload.error.message
          : response.statusText
      throw new Error(`Anthropic API error: ${errorMessage}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Response body is not readable')
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        yield { content: '', done: true }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            yield { content: '', done: true }
            return
          }

          try {
            const parsed = JSON.parse(data) as unknown
            if (!isRecord(parsed)) {
              continue
            }

            const eventType = typeof parsed.type === 'string' ? parsed.type : undefined
            if (eventType === 'content_block_delta' && isRecord(parsed.delta)) {
              const deltaType =
                typeof parsed.delta.type === 'string' ? parsed.delta.type : undefined
              if (deltaType === 'text_delta') {
                yield {
                  content: typeof parsed.delta.text === 'string' ? parsed.delta.text : '',
                  done: false,
                }
              }
            } else if (eventType === 'message_stop') {
              yield { content: '', done: true }
              return
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }

  private formatMessages(messages: Message[]): AnthropicMessage[] {
    return messages
      .map((msg): AnthropicMessage | null => {
        if (msg.role === 'system') {
          // System messages are handled separately in Anthropic API
          return null
        }

        const formatted: AnthropicMessage = {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }

        return formatted
      })
      .filter((message): message is AnthropicMessage => Boolean(message))
  }
}
