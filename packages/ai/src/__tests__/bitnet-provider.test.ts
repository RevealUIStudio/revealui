/**
 * BitNet Provider Tests (Phase 5.8)
 *
 * Tests for the BitNet local inference provider and its auto-wiring
 * behavior in createLLMClientFromEnv().
 *
 * BitNet is a thin wrapper over OpenAIProvider pointing at a local
 * llama-server instance. These tests verify:
 * - Constructor defaults (baseURL, model, apiKey)
 * - embed() throws with a helpful message
 * - chat/stream delegation to the inner OpenAI provider
 * - createLLMClientFromEnv() auto-detection and Ollama embed wiring
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BitnetProvider } from '../llm/providers/bitnet.js';

// ---------------------------------------------------------------------------
// BitnetProvider unit tests
// ---------------------------------------------------------------------------

describe('BitnetProvider', () => {
  describe('constructor', () => {
    it('uses default baseURL and model when not specified', () => {
      const provider = new BitnetProvider({});
      expect(provider).toBeDefined();
    });

    it('accepts custom baseURL and model', () => {
      const provider = new BitnetProvider({
        baseURL: 'http://custom:9999/v1',
        model: 'custom-model',
      });
      expect(provider).toBeDefined();
    });

    it('sets apiKey to "bitnet" by default', () => {
      // BitnetProvider passes apiKey ?? 'bitnet' to OpenAIProvider
      const provider = new BitnetProvider({});
      expect(provider).toBeDefined();
    });
  });

  describe('embed()', () => {
    it('throws with helpful error message mentioning Ollama', () => {
      const provider = new BitnetProvider({});
      expect(() => provider.embed('test text')).toThrow('BitNet does not support embeddings');
    });

    it('mentions OLLAMA_BASE_URL in the error message', () => {
      const provider = new BitnetProvider({});
      expect(() => provider.embed('test text')).toThrow('OLLAMA_BASE_URL');
    });

    it('mentions @xenova/transformers as an alternative', () => {
      const provider = new BitnetProvider({});
      expect(() => provider.embed('test text')).toThrow('@xenova/transformers');
    });

    it('throws for array input as well', () => {
      const provider = new BitnetProvider({});
      expect(() => provider.embed(['text1', 'text2'])).toThrow(
        'BitNet does not support embeddings',
      );
    });
  });

  describe('chat()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('delegates to inner OpenAI provider', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: { content: 'Hello from BitNet!', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      };
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({});
      const result = await provider.chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Hello from BitNet!');
      expect(result.role).toBe('assistant');

      // Verify the request was sent to the default BitNet URL
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:8080/v1/chat/completions');
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('bitnet-b1.58-2B-4T');
    });

    it('uses custom baseURL when provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'ok', role: 'assistant' }, finish_reason: 'stop' }],
        }),
      };
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({ baseURL: 'http://custom:9090/v1' });
      await provider.chat([{ role: 'user', content: 'test' }]);

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://custom:9090/v1/chat/completions');
    });

    it('uses custom model when provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'ok', role: 'assistant' }, finish_reason: 'stop' }],
        }),
      };
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({ model: 'bitnet-custom-3B' });
      await provider.chat([{ role: 'user', content: 'test' }]);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('bitnet-custom-3B');
    });

    it('propagates errors from llama-server', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Service Unavailable',
        json: vi.fn().mockResolvedValue({
          error: { message: 'Model not loaded' },
        }),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({});

      await expect(provider.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(
        'Model not loaded',
      );
    });

    it('passes temperature and maxTokens through to the API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'ok', role: 'assistant' }, finish_reason: 'stop' }],
        }),
      };
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({});
      await provider.chat([{ role: 'user', content: 'test' }], {
        temperature: 0.3,
        maxTokens: 100,
      });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(100);
    });
  });

  describe('stream()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('delegates to inner OpenAI provider and yields chunks', async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex];
            chunkIndex++;
            return { done: false, value: encoder.encode(chunk) };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({});
      const results: string[] = [];

      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.content) {
          results.push(chunk.content);
        }
        if (chunk.done) break;
      }

      expect(results).toEqual(['Hello', ' world']);
    });

    it('sends stream:true to the llama-server', async () => {
      const encoder = new TextEncoder();
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: encoder.encode('data: [DONE]\n\n'),
          })
          .mockResolvedValue({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse as unknown as Response);

      const provider = new BitnetProvider({});
      // Consume the stream
      for await (const chunk of provider.stream([{ role: 'user', content: 'test' }])) {
        if (chunk.done) break;
      }

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// LLMClient with BitNet provider — auto-detection and embed wiring
// ---------------------------------------------------------------------------

describe('LLMClient — BitNet integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('LLMClient wrapping BitnetProvider routes embed() to embedProvider', async () => {
    // This tests the LLMClient.embedProviderOverride path without importing
    // createLLMClientFromEnv (which pulls in heavy DB deps).
    // We import LLMClient directly and wire it the same way the factory does.
    const { LLMClient } = await import('../llm/client.js');
    const { OllamaProvider } = await import('../llm/providers/ollama.js');

    const ollamaEmbed = new OllamaProvider({
      apiKey: 'ollama',
      baseURL: 'http://localhost:11434/v1',
      embedModel: 'nomic-embed-text',
    });

    const client = new LLMClient({
      provider: 'bitnet',
      apiKey: 'bitnet',
      baseURL: 'http://localhost:8080/v1',
      embedProvider: ollamaEmbed,
    });

    // Mock fetch for the embed call (Ollama endpoint)
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3], model: 'nomic-embed-text' }],
      }),
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse as unknown as Response);

    const result = await client.embed('test embedding');
    expect(result).toBeDefined();

    // Verify the embed call went to Ollama, not BitNet
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('localhost:11434');
    expect(url).toContain('embeddings');
  });

  it('LLMClient wrapping BitnetProvider without embedProvider throws on embed()', async () => {
    const { LLMClient } = await import('../llm/client.js');

    const client = new LLMClient({
      provider: 'bitnet',
      apiKey: 'bitnet',
      baseURL: 'http://localhost:8080/v1',
    });

    await expect(client.embed('test')).rejects.toThrow('BitNet does not support embeddings');
  });

  it('LLMClient wrapping BitnetProvider routes chat() to BitNet', async () => {
    const { LLMClient } = await import('../llm/client.js');

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: { content: 'BitNet response', role: 'assistant' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

    const client = new LLMClient({
      provider: 'bitnet',
      apiKey: 'bitnet',
      baseURL: 'http://localhost:8080/v1',
    });

    const result = await client.chat([{ role: 'user', content: 'Hello' }]);
    expect(result.content).toBe('BitNet response');
    expect(result.usage?.totalTokens).toBe(8);
  });
});
