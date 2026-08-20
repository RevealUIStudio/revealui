import { describe, expect, it, vi } from 'vitest';

// Guardrail-2 hygiene finding (revealui#2198): `@revealui/ai` was declared in
// `optionalDependencies` but hard-imported at `main.ts:1` with no guard, so
// the actor could not even start without it -- the declaration didn't match
// runtime behavior. The fix makes the load genuinely lazy and the failure
// mode a clear, actionable error.
//
// Store 0.1.8: `import('@revealui/ai')` and `import('@revealui/ai/llm/client')`
// both evaluate `@revealui/db/client` via SemanticCache. Published 0.10.1
// exports `./llm/providers/base` (side-effect free); Groq/xAI/OpenAI/Anthropic
// live next to that file and do not load config.

describe('loadLLMClient', () => {
  it('returns a chat client from the providers/base sibling module', async () => {
    vi.resetModules();
    const chat = vi.fn(async () => ({ content: 'ok', role: 'assistant' as const }));
    class FakeGroqProvider {
      chat = chat;
    }
    const resolve = vi.fn((specifier: string) => {
      expect(specifier).toBe('@revealui/ai/llm/providers/base');
      return 'file:///fake/node_modules/@revealui/ai/dist/llm/providers/base.js';
    });
    const load = vi.fn(async (url: string) => {
      expect(url).toBe('file:///fake/node_modules/@revealui/ai/dist/llm/providers/groq.js');
      return { GroqProvider: FakeGroqProvider };
    });

    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    const LLMClient = await loadLLMClient('groq', { resolve, load });
    const llmClient = new LLMClient({
      provider: 'groq',
      apiKey: 'gsk_test',
      model: 'openai/gpt-oss-120b',
    });
    const response = await llmClient.chat([{ role: 'user', content: 'hi' }]);
    expect(response.content).toBe('ok');
    expect(chat).toHaveBeenCalled();
  });

  it('uses openai/gpt-oss-120b when Groq model is blank', async () => {
    vi.resetModules();
    const constructed: Array<{ apiKey: string; model?: string }> = [];
    class FakeGroqProvider {
      constructor(config: { apiKey: string; model?: string }) {
        constructed.push(config);
      }
      chat = vi.fn();
    }
    const resolve = vi.fn(
      () => 'file:///fake/node_modules/@revealui/ai/dist/llm/providers/base.js',
    );
    const load = vi.fn(async () => ({ GroqProvider: FakeGroqProvider }));
    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    const LLMClient = await loadLLMClient('groq', { resolve, load });
    new LLMClient({ provider: 'groq', apiKey: 'gsk_test' });
    expect(constructed).toEqual([{ apiKey: 'gsk_test', model: 'openai/gpt-oss-120b' }]);
  });

  it('remaps retired Groq catalog ids instead of sending them', async () => {
    vi.resetModules();
    const constructed: Array<{ apiKey: string; model?: string }> = [];
    class FakeGroqProvider {
      constructor(config: { apiKey: string; model?: string }) {
        constructed.push(config);
      }
      chat = vi.fn();
    }
    const resolve = vi.fn(
      () => 'file:///fake/node_modules/@revealui/ai/dist/llm/providers/base.js',
    );
    const load = vi.fn(async () => ({ GroqProvider: FakeGroqProvider }));
    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    const LLMClient = await loadLLMClient('groq', { resolve, load });
    new LLMClient({
      provider: 'groq',
      apiKey: 'gsk_test',
      model: 'qwen/qwen3-32b',
    });
    expect(constructed[0]?.model).toBe('openai/gpt-oss-120b');
  });

  it('leaves a current Groq catalog id alone', async () => {
    vi.resetModules();
    const constructed: Array<{ apiKey: string; model?: string }> = [];
    class FakeGroqProvider {
      constructor(config: { apiKey: string; model?: string }) {
        constructed.push(config);
      }
      chat = vi.fn();
    }
    const resolve = vi.fn(
      () => 'file:///fake/node_modules/@revealui/ai/dist/llm/providers/base.js',
    );
    const load = vi.fn(async () => ({ GroqProvider: FakeGroqProvider }));
    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    const LLMClient = await loadLLMClient('groq', { resolve, load });
    new LLMClient({
      provider: 'groq',
      apiKey: 'gsk_test',
      model: 'openai/gpt-oss-20b',
    });
    expect(constructed[0]?.model).toBe('openai/gpt-oss-20b');
  });

  it('throws a clear, actionable error when the provider module cannot be loaded', async () => {
    vi.resetModules();
    const resolve = vi.fn(() => {
      throw new Error("Cannot find package '@revealui/ai/llm/providers/base'");
    });
    const load = vi.fn();

    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    await expect(loadLLMClient('groq', { resolve, load })).rejects.toThrow(
      /run-task mode requires @revealui\/ai/,
    );
    expect(load).not.toHaveBeenCalled();
  });
});
