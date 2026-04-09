/**
 * VultrProvider Unit Tests
 *
 * Tests for the Vultr Serverless Inference API provider.
 * All HTTP calls are intercepted with vi.spyOn(globalThis, 'fetch').
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VultrProviderConfig } from '../providers/vultr.js';
import { VultrProvider } from '../providers/vultr.js';

const defaultConfig: VultrProviderConfig = {
  apiKey: 'test-api-key',
  model: 'qwen2.5-72b-instruct',
  temperature: 0.7,
};

function makeProvider(overrides?: Partial<VultrProviderConfig>): VultrProvider {
  return new VultrProvider({ ...defaultConfig, ...overrides });
}

function makeFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeChatResponse(content: string, toolCalls?: unknown[]) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

describe('VultrProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use default Vultr base URL', () => {
      const provider = makeProvider();
      // Access private via cast for verification
      expect((provider as unknown as { baseURL: string }).baseURL).toBe(
        'https://api.vultrinference.com/v1',
      );
    });

    it('should use custom baseURL if provided', () => {
      const provider = makeProvider({ baseURL: 'https://custom.example.com/v1' });
      expect((provider as unknown as { baseURL: string }).baseURL).toBe(
        'https://custom.example.com/v1',
      );
    });
  });

  // ─── chat() ─────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('should POST to /chat/completions and return content', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('Hello world')));

      const provider = makeProvider();
      const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/chat/completions');
      expect(init.method).toBe('POST');
      expect(result.content).toBe('Hello world');
      expect(result.role).toBe('assistant');
    });

    it('should include Authorization header with Bearer token', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('ok')));

      await makeProvider().chat([{ role: 'user', content: 'test' }]);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should send model, messages, and temperature in body', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('ok')));

      await makeProvider().chat([{ role: 'user', content: 'hello' }], { temperature: 0.5 });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.model).toBe('qwen2.5-72b-instruct');
      expect(body.temperature).toBe(0.5);
      expect(Array.isArray(body.messages)).toBe(true);
    });

    it('should use config temperature as fallback', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('ok')));

      await makeProvider({ temperature: 0.3 }).chat([{ role: 'user', content: 'hello' }]);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.temperature).toBe(0.3);
    });

    it('should parse tool_calls from response', async () => {
      const toolCall = {
        id: 'call_abc123',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"NYC"}' },
      };
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('', [toolCall])));

      const result = await makeProvider().chat([{ role: 'user', content: 'weather?' }]);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0]).toEqual({
        id: 'call_abc123',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"NYC"}' },
      });
    });

    it('should throw on non-2xx response with string error', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse({ error: 'model not found' }, 404));

      await expect(makeProvider().chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
        'Vultr API error: model not found',
      );
    });

    it('should throw on non-2xx response using statusText as fallback', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(makeProvider().chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
        'Vultr API error: Internal Server Error',
      );
    });

    it('should handle empty tool_calls array gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(makeChatResponse('response', [])));

      const result = await makeProvider().chat([{ role: 'user', content: 'hi' }]);
      // Provider maps empty array through — callers should treat [] same as undefined
      expect(result.toolCalls).toEqual([]);
    });

    it('should handle response with no choices gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse({ choices: [] }));

      const result = await makeProvider().chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('');
    });
  });

  // ─── embed() ────────────────────────────────────────────────────────────────

  describe('embed()', () => {
    const embeddingResponse = {
      data: [{ embedding: [0.1, 0.2, 0.3], model: 'qwen2.5-72b-instruct' }],
    };

    it('should POST to /embeddings and return single embedding for string input', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(embeddingResponse));

      const result = await makeProvider().embed('hello world');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0] as [string];
      expect(url).toContain('/embeddings');

      expect(Array.isArray(result)).toBe(false);
      const embedding = result as { vector: number[]; dimension: number };
      expect(embedding.vector).toEqual([0.1, 0.2, 0.3]);
      expect(embedding.dimension).toBe(3);
    });

    it('should return array of embeddings for array input', async () => {
      const multiResponse = {
        data: [
          { embedding: [0.1, 0.2], model: 'qwen2.5-72b-instruct' },
          { embedding: [0.3, 0.4], model: 'qwen2.5-72b-instruct' },
        ],
      };
      fetchSpy.mockResolvedValueOnce(makeFetchResponse(multiResponse));

      const result = await makeProvider().embed(['hello', 'world']);

      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(2);
    });

    it('should throw a clear error when embeddings endpoint returns 404', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 404, statusText: 'Not Found' }));

      await expect(makeProvider().embed('test')).rejects.toThrow(
        'Vultr embeddings not available for this configuration',
      );
    });

    it('should throw on other embeddings errors', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Server Error' }));

      await expect(makeProvider().embed('test')).rejects.toThrow(
        'Vultr embeddings API error: Server Error',
      );
    });
  });

  // ─── stream() ───────────────────────────────────────────────────────────────

  describe('stream()', () => {
    function makeSSEStream(lines: string[]): Response {
      const body = `${lines.join('\n')}\n`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }

    function sseChunk(content: string): string {
      return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
    }

    it('should yield content chunks from SSE stream', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeSSEStream([sseChunk('Hello'), sseChunk(' world'), 'data: [DONE]']),
      );

      const provider = makeProvider();
      const chunks: string[] = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
        if (!chunk.done) chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should set stream: true in request body', async () => {
      fetchSpy.mockResolvedValueOnce(makeSSEStream(['data: [DONE]']));

      const provider = makeProvider();
      // Consume the stream
      for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
      }

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.stream).toBe(true);
    });

    it('should yield done: true chunk at end of [DONE] signal', async () => {
      fetchSpy.mockResolvedValueOnce(makeSSEStream([sseChunk('hi'), 'data: [DONE]']));

      const provider = makeProvider();
      const chunks: Array<{ content: string; done: boolean }> = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'go' }])) {
        chunks.push(chunk);
      }

      const doneChunk = chunks.find((c) => c.done);
      expect(doneChunk).toBeDefined();
    });

    it('should throw on non-2xx stream response', async () => {
      fetchSpy.mockResolvedValueOnce(makeFetchResponse({ error: 'rate limited' }, 429));

      const provider = makeProvider();
      await expect(async () => {
        for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
        }
      }).rejects.toThrow('Vultr streaming error: rate limited');
    });

    it('should skip malformed SSE lines gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeSSEStream(['data: {invalid json}', sseChunk('valid'), 'data: [DONE]']),
      );

      const provider = makeProvider();
      const chunks: string[] = [];
      for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
        if (!chunk.done) chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['valid']);
    });
  });
});
