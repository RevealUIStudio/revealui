/**
 * Anthropic Provider
 *
 * Implementation of LLMProvider for Anthropic Claude API
 */

import type {
  ContentPart,
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
} from './base.js';

/**
 * Extract plain text from a message content value.
 * Anthropic has its own image format — for now, image parts are silently skipped
 * and only text parts are forwarded. Vision via Anthropic is out of scope.
 */
function toTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

export interface AnthropicProviderConfig extends LLMProviderConfig {
  apiVersion?: string;
  /** Enable prompt caching by default (5min TTL, 90% cost reduction on cache hits) */
  enableCacheByDefault?: boolean;
}

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

type AnthropicSystemBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  cache_control?: { type: 'ephemeral' };
};

type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
};

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | { type: string; [key: string]: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTextBlock = (block: AnthropicContentBlock): block is AnthropicTextBlock =>
  block.type === 'text' && typeof (block as AnthropicTextBlock).text === 'string';

const isToolUseBlock = (block: AnthropicContentBlock): block is AnthropicToolUseBlock =>
  block.type === 'tool_use';

const maxTokensKey = 'max_tokens' as const;
const inputTokensKey = 'input_tokens' as const;
const outputTokensKey = 'output_tokens' as const;
const stopReasonKey = 'stop_reason' as const;
const cacheCreationTokensKey = 'cache_creation_input_tokens' as const;
const cacheReadTokensKey = 'cache_read_input_tokens' as const;

export class AnthropicProvider implements LLMProvider {
  private config: AnthropicProviderConfig;
  private baseURL: string;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    // Anthropic API format is slightly different
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const enableCache = options?.enableCache ?? this.config.enableCacheByDefault ?? false;

    // Use 2024-07-15 API version for prompt caching support
    const apiVersion = enableCache ? '2024-07-15' : this.config.apiVersion || '2023-06-01';

    // Format system messages with caching
    const systemContent = this.formatSystemMessages(systemMessages, enableCache);

    // Format tools with caching (cache last tool if enabled)
    const tools = this.formatTools(options?.tools, enableCache);

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': apiVersion,
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        system: systemContent,
        messages: this.formatMessages(conversationMessages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        tools,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown;
      const errorMessage =
        isRecord(errorPayload) &&
        isRecord(errorPayload.error) &&
        typeof errorPayload.error.message === 'string'
          ? errorPayload.error.message
          : response.statusText;
      throw new Error(`Anthropic API error: ${errorMessage}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const contentBlocks = Array.isArray(data.content)
      ? (data.content as AnthropicContentBlock[])
      : [];
    const textBlock = contentBlocks.find(isTextBlock);
    const toolCalls: ToolCall[] | undefined = contentBlocks.filter(isToolUseBlock).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.input),
      },
    }));
    const usage =
      data.usage && typeof data.usage === 'object'
        ? (data.usage as Record<string, unknown>)
        : undefined;
    const inputTokens =
      usage && typeof usage[inputTokensKey] === 'number' ? usage[inputTokensKey] : undefined;
    const outputTokens =
      usage && typeof usage[outputTokensKey] === 'number' ? usage[outputTokensKey] : undefined;
    const cacheCreationTokens =
      usage && typeof usage[cacheCreationTokensKey] === 'number'
        ? usage[cacheCreationTokensKey]
        : undefined;
    const cacheReadTokens =
      usage && typeof usage[cacheReadTokensKey] === 'number'
        ? usage[cacheReadTokensKey]
        : undefined;
    const finishReason =
      typeof data[stopReasonKey] === 'string'
        ? (data[stopReasonKey] as LLMResponse['finishReason'])
        : undefined;

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
              cacheCreationTokens,
              cacheReadTokens,
            }
          : undefined,
    };
  }

  embed(text: string | string[], options?: LLMEmbedOptions): Promise<Embedding | Embedding[]> {
    void text;
    void options;
    // Anthropic doesn't have a separate embeddings API
    // Would need to use a different provider or service
    return Promise.reject(
      new Error('Anthropic does not support embeddings. Use OpenAI provider for embeddings.'),
    );
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const enableCache = options?.enableCache ?? this.config.enableCacheByDefault ?? false;

    // Use 2024-07-15 API version for prompt caching support
    const apiVersion = enableCache ? '2024-07-15' : this.config.apiVersion || '2023-06-01';

    // Format system messages with caching
    const systemContent = this.formatSystemMessages(systemMessages, enableCache);

    // Format tools with caching
    const tools = this.formatTools(options?.tools, enableCache);

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': apiVersion,
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        system: systemContent,
        messages: this.formatMessages(conversationMessages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown;
      const errorMessage =
        isRecord(errorPayload) &&
        isRecord(errorPayload.error) &&
        typeof errorPayload.error.message === 'string'
          ? errorPayload.error.message
          : response.statusText;
      throw new Error(`Anthropic API error: ${errorMessage}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { content: '', done: true };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data) as unknown;
            if (!isRecord(parsed)) {
              continue;
            }

            const eventType = typeof parsed.type === 'string' ? parsed.type : undefined;
            if (eventType === 'content_block_delta' && isRecord(parsed.delta)) {
              const deltaType =
                typeof parsed.delta.type === 'string' ? parsed.delta.type : undefined;
              if (deltaType === 'text_delta') {
                yield {
                  content: typeof parsed.delta.text === 'string' ? parsed.delta.text : '',
                  done: false,
                };
              }
            } else if (eventType === 'message_stop') {
              yield { content: '', done: true };
              return;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }

  /**
   * Format system messages with optional caching
   * Caches the last system message for maximum benefit
   */
  private formatSystemMessages(
    systemMessages: Message[],
    enableCache: boolean,
  ): string | AnthropicSystemBlock[] {
    if (systemMessages.length === 0) {
      return '';
    }

    // If caching disabled, use simple string format
    if (!enableCache) {
      return systemMessages.map((m) => toTextContent(m.content)).join('\n');
    }

    // With caching, use structured format and cache the last block
    return systemMessages.map((msg, index) => ({
      type: 'text' as const,
      text: toTextContent(msg.content),
      // Cache the last system message (most likely to be reused)
      ...(index === systemMessages.length - 1 && msg.cacheControl
        ? { cache_control: msg.cacheControl }
        : index === systemMessages.length - 1
          ? { cache_control: { type: 'ephemeral' as const } }
          : {}),
    }));
  }

  /**
   * Format tools with optional caching
   * Caches the last tool definition for maximum benefit
   */
  private formatTools(
    tools: LLMChatOptions['tools'] | undefined,
    enableCache: boolean,
  ): AnthropicTool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool, index) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
      // Cache the last tool (most likely to be reused across calls)
      ...(enableCache && index === tools.length - 1
        ? { cache_control: { type: 'ephemeral' as const } }
        : {}),
    }));
  }

  private formatMessages(messages: Message[]): AnthropicMessage[] {
    return messages
      .map((msg): AnthropicMessage | null => {
        if (msg.role === 'system') {
          // System messages are handled separately in Anthropic API
          return null;
        }

        const formatted: AnthropicMessage = {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          // Anthropic uses a different image format; extract text only for now.
          content: toTextContent(msg.content),
        };

        return formatted;
      })
      .filter((message): message is AnthropicMessage => Boolean(message));
  }
}
