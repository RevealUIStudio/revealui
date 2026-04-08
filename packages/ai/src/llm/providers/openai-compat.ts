/**
 * OpenAI-Compatible Provider
 *
 * Base implementation for any LLM API that follows the OpenAI chat/completions
 * format. Used by: Ollama, Groq, Inference Snaps, BitNet, Vultr.
 * NOT for direct OpenAI usage — RevealUI uses open-source models only.
 */

import type {
  Embedding,
  FinishReason,
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

export interface OpenAICompatConfig extends LLMProviderConfig {}

type OpenAIChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAIChatResponse = {
  choices?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
};

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    model?: string;
  }>;
};

type OpenAIStreamChunk = {
  choices?: Array<Record<string, unknown>>;
};

const authorizationHeader = 'Authorization' as const;
const maxTokensKey = 'max_tokens' as const;
const toolChoiceKey = 'tool_choice' as const;
const toolCallsKey = 'tool_calls' as const;
const toolCallIdKey = 'tool_call_id' as const;
const finishReasonKey = 'finish_reason' as const;
const promptTokensKey = 'prompt_tokens' as const;
const completionTokensKey = 'completion_tokens' as const;
const totalTokensKey = 'total_tokens' as const;

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const isFunctionToolCall = (call: unknown): call is OpenAIChatToolCall => {
  const record = asRecord(call);
  if (!record || record.type !== 'function' || typeof record.id !== 'string') {
    return false;
  }
  const fn = asRecord(record.function);
  return !!fn && typeof fn.name === 'string' && typeof fn.arguments === 'string';
};

export class OpenAICompatProvider implements LLMProvider {
  private config: OpenAICompatConfig;
  private baseURL: string;

  constructor(config: OpenAICompatConfig) {
    this.config = config;
    if (!config.baseURL) {
      throw new Error(
        'OpenAICompatProvider requires a baseURL — use a specific provider (InferenceSnapsProvider, BitNetProvider, OllamaProvider, etc.)',
      );
    }
    this.baseURL = config.baseURL;
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'default',
        messages: this.formatMessages(messages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens,
        tools: options?.tools,
        [toolChoiceKey]: options?.toolChoice,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown;
      const errorRecord = asRecord(errorPayload);
      const errorDetail = asRecord(errorRecord?.error);
      const errorMessage =
        errorDetail && typeof errorDetail.message === 'string'
          ? errorDetail.message
          : response.statusText;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices?.[0];
    const choiceRecord = asRecord(choice);
    const messageRecord = asRecord(choiceRecord?.message);
    const rawToolCalls = messageRecord?.[toolCallsKey];
    const toolCalls: ToolCall[] | undefined = Array.isArray(rawToolCalls)
      ? rawToolCalls.filter(isFunctionToolCall).map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }))
      : undefined;
    const finishReasonValue = choiceRecord?.[finishReasonKey];
    const finishReason: FinishReason | undefined =
      typeof finishReasonValue === 'string' ? (finishReasonValue as FinishReason) : undefined;

    const usageRecord = asRecord(data.usage);
    const promptTokens =
      usageRecord && typeof usageRecord[promptTokensKey] === 'number'
        ? usageRecord[promptTokensKey]
        : undefined;
    const completionTokens =
      usageRecord && typeof usageRecord[completionTokensKey] === 'number'
        ? usageRecord[completionTokensKey]
        : undefined;
    const totalTokens =
      usageRecord && typeof usageRecord[totalTokensKey] === 'number'
        ? usageRecord[totalTokensKey]
        : undefined;

    return {
      content: typeof messageRecord?.content === 'string' ? messageRecord.content : '',
      role: 'assistant',
      toolCalls,
      finishReason,
      usage:
        promptTokens !== undefined && completionTokens !== undefined && totalTokens !== undefined
          ? {
              promptTokens,
              completionTokens,
              totalTokens,
            }
          : undefined,
    };
  }

  async embed(
    text: string | string[],
    options?: LLMEmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    const texts = Array.isArray(text) ? text : [text];
    const model = options?.model || 'text-embedding-3-small';

    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      // lgtm[js/file-access-to-http] — embedding providers must send text to their API by design
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown;
      const errorRecord = asRecord(errorPayload);
      const errorDetail = asRecord(errorRecord?.error);
      const errorMessage =
        errorDetail && typeof errorDetail.message === 'string'
          ? errorDetail.message
          : response.statusText;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    const embeddings = (data.data || []).map((item) => {
      const vector = item.embedding || [];
      return {
        vector,
        dimension: vector.length,
        model: item.model || model,
      };
    });

    return Array.isArray(text) ? embeddings : (embeddings[0] as Embedding);
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'default',
        messages: this.formatMessages(messages),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        [maxTokensKey]: options?.maxTokens ?? this.config.maxTokens,
        tools: options?.tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => undefined)) as unknown;
      const errorRecord = asRecord(errorPayload);
      const errorDetail = asRecord(errorRecord?.error);
      const errorMessage =
        errorDetail && typeof errorDetail.message === 'string'
          ? errorDetail.message
          : response.statusText;
      throw new Error(`OpenAI API error: ${errorMessage}`);
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
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const choice = parsed.choices?.[0];
            const choiceRecord = asRecord(choice);
            const deltaRecord = asRecord(choiceRecord?.delta);
            if (deltaRecord) {
              const deltaToolCalls = Array.isArray(deltaRecord[toolCallsKey])
                ? (deltaRecord[toolCallsKey] as unknown[]).filter(isFunctionToolCall).map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments,
                    },
                  }))
                : undefined;
              yield {
                content: typeof deltaRecord.content === 'string' ? deltaRecord.content : '',
                done: false,
                toolCalls: deltaToolCalls as ToolCall[] | undefined,
              };
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }

  private formatMessages(messages: Message[]): Array<Record<string, unknown>> {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        // Pass array content through as-is — OpenAI-compatible APIs (including
        // inference-snaps vision models) accept the same multipart format natively.
        content: msg.content,
      };

      if (msg.name) {
        formatted.name = msg.name;
      }

      if (msg.toolCalls) {
        formatted[toolCallsKey] = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        }));
      }

      if (msg.toolCallId) {
        formatted[toolCallIdKey] = msg.toolCallId;
      }

      return formatted;
    });
  }
}
