/**
 * Reasoner conformance — transport tier (P2b, ADR 2026-06-25).
 *
 * The anti-lying property: for every capability flag the suite runs the POSITIVE
 * assertion iff `capabilities()[flag] === true`, else the INERTNESS assertion. A
 * provider that advertises a capability it doesn't wire fails the positive check;
 * one that advertises false but emits a native field fails the inertness check.
 *
 * This tier is offline + deterministic: `fetch` is stubbed and the outbound request
 * (or the parsed response) is inspected via a request-capture spy. The golden
 * capability-profile snapshots, purity, and consistency invariants live in the
 * sibling `capabilities.test.ts`. Behavioral assertions (does prompt-cache actually
 * cache, does the model actually reason) are non-deterministic and belong to the
 * env-gated live tier (Tier 2) / the Claude adapter's external tier (Tier 3) — not here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../base.js';
import { GroqProvider } from '../groq.js';
import { OpenAICompatProvider } from '../openai-compat.js';

type CapturedCall = { url: string; body: Record<string, unknown> };

/** Stub global fetch to capture outbound requests and return a canned JSON response. */
function stubJsonFetch(responseBody: unknown): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      calls.push({ url: String(url), body });
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

const CHAT_RESPONSE = {
  choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const TOOL: ToolDefinition = {
  type: 'function',
  function: { name: 'search', description: 'Search the web', parameters: { type: 'object' } },
};

const newProvider = () =>
  new OpenAICompatProvider({ apiKey: 'test', baseURL: 'http://localhost:9999/v1' });

describe('Reasoner conformance — transport tier (openai-compat)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('tools', () => {
    it('positive: advertises tools and forwards them on the wire', async () => {
      const calls = stubJsonFetch(CHAT_RESPONSE);
      const p = newProvider();
      expect(p.capabilities().tools).toBe(true);
      await p.chat([{ role: 'user', content: 'hi' }], { tools: [TOOL] });
      expect(calls[0]?.body.tools).toBeDefined();
    });
  });

  describe('reasoningEffort (inertness)', () => {
    it('advertises false and emits no native reasoning field even when effort is set', async () => {
      const calls = stubJsonFetch(CHAT_RESPONSE);
      const p = newProvider();
      expect(p.capabilities().reasoningEffort).toBe(false);
      await p.chat([{ role: 'user', content: 'hi' }], { effort: 'high' });
      const body = calls[0]?.body ?? {};
      expect(body.thinking).toBeUndefined();
      expect(body.reasoning).toBeUndefined();
      expect(body.reasoning_effort).toBeUndefined();
    });
  });

  describe('promptCache (inertness)', () => {
    it('advertises false and emits no cache-control even when cacheHint/cache are set', async () => {
      const calls = stubJsonFetch(CHAT_RESPONSE);
      const p = newProvider();
      expect(p.capabilities().promptCache).toBe(false);
      await p.chat([{ role: 'system', content: 'sys', cache: true }], { cacheHint: true });
      const serialized = JSON.stringify(calls[0]?.body ?? {});
      expect(serialized).not.toContain('cache_control');
      expect(serialized).not.toContain('cacheControl');
    });

    it('does not surface cache usage fields when promptCache is false', async () => {
      const calls = stubJsonFetch({
        choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cache_read_input_tokens: 7,
        },
      });
      const p = newProvider();
      const res = await p.chat([{ role: 'user', content: 'hi' }]);
      expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      expect(res.usage?.cacheReadTokens).toBeUndefined();
      expect(calls).toHaveLength(1);
    });
  });

  describe('providerOptions (opaque isolation)', () => {
    it('never leaks a foreign namespace payload onto the wire', async () => {
      const calls = stubJsonFetch(CHAT_RESPONSE);
      const p = newProvider();
      await p.chat([{ role: 'user', content: 'hi' }], {
        providerOptions: { 'x-anthropic': { sentinel: 'LEAK_ME_NOT' } },
      });
      expect(JSON.stringify(calls[0]?.body ?? {})).not.toContain('LEAK_ME_NOT');
    });
  });

  describe('embeddings', () => {
    it('positive: openai-compat advertises embeddings and returns a vector', async () => {
      stubJsonFetch({ data: [{ embedding: [0.1, 0.2, 0.3], model: 'm' }] });
      const p = newProvider();
      expect(p.capabilities().embeddings).toBe(true);
      const e = await p.embed('hello');
      expect(Array.isArray(e)).toBe(false);
      expect((e as { vector: number[] }).vector).toEqual([0.1, 0.2, 0.3]);
    });

    it('inertness: groq advertises no embeddings and throws on embed()', () => {
      const g = new GroqProvider({ apiKey: 'test' });
      expect(g.capabilities().embeddings).toBe(false);
      expect(() => g.embed('hello')).toThrow();
    });
  });

  describe('streaming', () => {
    it('positive: advertises streaming, yields content chunks then a terminal done', async () => {
      const sse =
        'data: {"choices":[{"delta":{"content":"he"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n' +
        'data: [DONE]\n';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sse));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        }),
      );
      const p = newProvider();
      expect(p.capabilities().streaming).toBe(true);

      let text = '';
      let sawDone = false;
      for await (const chunk of p.stream([{ role: 'user', content: 'hi' }])) {
        text += chunk.content;
        if (chunk.done) sawDone = true;
      }
      expect(text).toBe('hello');
      expect(sawDone).toBe(true);
    });
  });
});
