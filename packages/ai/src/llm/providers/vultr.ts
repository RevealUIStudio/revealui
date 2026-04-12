/**
 * Vultr Inference Provider
 *
 * Implements the LLMProvider interface for Vultr Serverless Inference API
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
} from './base.js';

export interface VultrProviderConfig extends LLMProviderConfig {
  subscriptionId?: string;
}

const authorizationHeader = 'Authorization' as const;
const contentTypeHeader = 'Content-Type' as const;

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;

const isFunctionToolCall = (
  call: unknown,
): call is { id: string; type: string; function?: { name: string; arguments?: string } } => {
  const r = asRecord(call);
  if (!r) return false;
  return r.type === 'function' && typeof r.id === 'string';
};

export class VultrProvider implements LLMProvider {
  private config: VultrProviderConfig;
  private baseURL: string;

  constructor(config: VultrProviderConfig) {
    this.config = config;
    this.baseURL = config.baseURL || 'https://api.vultrinference.com/v1';
  }

  async chat(messages: Message[], options?: LLMChatOptions): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content, name: m.name })),
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      tools: options?.tools,
    };

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        [contentTypeHeader]: 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => undefined);
      const rec = asRecord(json);
      const err = rec && typeof rec.error === 'string' ? rec.error : res.statusText;
      throw new Error(`Vultr API error: ${err}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choice = Array.isArray(data.choices) ? (data.choices as unknown[])[0] : undefined;
    const choiceRec = asRecord(choice);
    const message = asRecord(choiceRec?.message);

    // Parse tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (message && Array.isArray(message.tool_calls || message.toolCalls)) {
      const raw = (message.tool_calls || message.toolCalls) as unknown[];
      toolCalls = raw.filter(isFunctionToolCall).map((tc) => {
        const r = asRecord(tc) ?? {};
        const fn = asRecord(r.function);
        return {
          id: String(r.id),
          type: 'function',
          function: {
            name: typeof fn?.name === 'string' ? (fn?.name as string) : '',
            arguments:
              typeof fn?.arguments === 'string'
                ? (fn?.arguments as string)
                : JSON.stringify(fn?.arguments ?? {}),
          },
        };
      });
    }

    return {
      content: typeof message?.content === 'string' ? message.content : '',
      role: 'assistant',
      toolCalls,
      finishReason: undefined,
    };
  }

  async embed(
    text: string | string[],
    options?: LLMEmbedOptions,
  ): Promise<Embedding | Embedding[]> {
    // Vultr may support embeddings on some models. Try /embeddings endpoint if available.
    const inputs = Array.isArray(text) ? text : [text];
    const model = options?.model || this.config.model;

    const res = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        [contentTypeHeader]: 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      // lgtm[js/file-access-to-http]  -  embedding providers must send text to their API by design
      body: JSON.stringify({ model, input: inputs }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => undefined);
      const rec = asRecord(json);
      // If embeddings not supported, throw a clear error
      if (res.status === 404 || (rec?.error && typeof rec.error === 'string')) {
        throw new Error('Vultr embeddings not available for this configuration');
      }
      throw new Error(`Vultr embeddings API error: ${res.statusText}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(data.data) ? (data.data as unknown[]) : [];
    const embeddings = items.map((it) => {
      const rec = asRecord(it);
      const vector = Array.isArray(rec?.embedding) ? (rec?.embedding as number[]) : [];
      return {
        vector,
        dimension: vector.length,
        model: typeof rec?.model === 'string' ? rec?.model : String(model),
      };
    });

    return Array.isArray(text) ? embeddings : (embeddings[0] as Embedding);
  }

  async *stream(messages: Message[], options?: LLMStreamOptions): AsyncIterable<LLMChunk> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content, name: m.name })),
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      stream: true,
    };

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        [contentTypeHeader]: 'application/json',
        [authorizationHeader]: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => undefined);
      const rec = asRecord(json);
      const err = rec && typeof rec.error === 'string' ? rec.error : res.statusText;
      throw new Error(`Vultr streaming error: ${err}`);
    }

    const reader = res.body?.getReader();
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
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : undefined;
            // Vultr uses OpenAI-compatible SSE format: delta not message
            const delta = asRecord(asRecord(choice)?.delta);
            if (delta && typeof delta.content === 'string') {
              yield { content: delta.content, done: false };
            }
          } catch {
            // ignore partial JSON
          }
        }
      }
    }
  }
}
