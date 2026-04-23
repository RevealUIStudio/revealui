/**
 * Stage 5.2 — tests for `createSamplingHandler`.
 *
 * The handler routes MCP `sampling/createMessage` requests through an
 * agent-configured LLM. Tests cover message conversion, model selection,
 * allowlist safety, finish-reason mapping, error propagation, and the
 * observability hook. Uses structural stubs that match `SamplingLLM`
 * without importing from `@revealui/ai/llm/providers` (keeps tests light).
 */

import { describe, expect, it, vi } from 'vitest';
import type { LLMResponse, Message } from '../../llm/providers/base.js';
import {
  createSamplingHandler,
  type McpSamplingRequestParams,
  type SamplingLLM,
} from '../../tools/mcp-sampling.js';

function makeLLM(response: Partial<LLMResponse> = {}): SamplingLLM & {
  chat: ReturnType<typeof vi.fn>;
} {
  return {
    chat: vi.fn(async () => ({
      content: 'pretend LLM output',
      role: 'assistant',
      finishReason: 'stop',
      ...response,
    })),
  };
}

function makeParams(overrides: Partial<McpSamplingRequestParams> = {}): McpSamplingRequestParams {
  return {
    messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
    maxTokens: 256,
    ...overrides,
  };
}

describe('createSamplingHandler', () => {
  it('routes a minimal request through the configured LLM', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm, defaultModel: 'gemma3' });

    const result = await handler(makeParams());

    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(result.role).toBe('assistant');
    expect(result.content).toEqual({ type: 'text', text: 'pretend LLM output' });
    expect(result.model).toBe('gemma3');
  });

  it('converts MCP messages to LLM Messages, preserving role + text', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm });
    await handler(
      makeParams({
        messages: [
          { role: 'user', content: { type: 'text', text: 'question' } },
          { role: 'assistant', content: { type: 'text', text: 'answer' } },
          { role: 'user', content: { type: 'text', text: 'follow-up' } },
        ],
      }),
    );

    const passed = llm.chat.mock.calls[0]?.[0] as Message[];
    expect(passed).toEqual([
      { role: 'user', content: 'question' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'follow-up' },
    ]);
  });

  it('prepends systemPrompt as a system message when provided', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm });
    await handler(makeParams({ systemPrompt: 'You are a helpful assistant.' }));

    const passed = llm.chat.mock.calls[0]?.[0] as Message[];
    expect(passed[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    expect(passed[1]?.role).toBe('user');
  });

  it('forwards temperature + maxTokens to the LLM', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm });
    await handler(makeParams({ temperature: 0.7, maxTokens: 1024 }));

    const chatOptions = llm.chat.mock.calls[0]?.[1];
    expect(chatOptions).toEqual({ temperature: 0.7, maxTokens: 1024 });
  });

  it('throws when a message carries non-text content (text-only in Stage 5.2)', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm });

    await expect(
      handler(
        makeParams({
          messages: [
            {
              role: 'user',
              content: { type: 'image', data: 'base64…', mimeType: 'image/png' },
            },
          ],
        }),
      ),
    ).rejects.toThrow(/non-text/);
  });
});

describe('createSamplingHandler — model selection', () => {
  it('picks the first hint whose name is in the allowlist', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({
      llm,
      allowedModels: ['gemma3', 'deepseek-r1'],
      defaultModel: 'gemma3',
    });
    const result = await handler(
      makeParams({
        modelPreferences: {
          hints: [{ name: 'gpt-4o' }, { name: 'deepseek-r1' }, { name: 'gemma3' }],
        },
      }),
    );
    expect(result.model).toBe('deepseek-r1');
  });

  it('falls back to defaultModel when no hint matches the allowlist', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({
      llm,
      allowedModels: ['gemma3'],
      defaultModel: 'gemma3',
    });
    const result = await handler(
      makeParams({ modelPreferences: { hints: [{ name: 'gpt-4o' }, { name: 'claude-4' }] } }),
    );
    expect(result.model).toBe('gemma3');
  });

  it('accepts any hint when no allowlist is configured', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm, defaultModel: 'whatever' });
    const result = await handler(
      makeParams({ modelPreferences: { hints: [{ name: 'arbitrary-model' }] } }),
    );
    expect(result.model).toBe('arbitrary-model');
  });

  it('reports "unknown" when neither hints nor defaultModel are set', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm });
    const result = await handler(makeParams());
    expect(result.model).toBe('unknown');
  });

  it('honors a custom selectModel callback', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({
      llm,
      allowedModels: ['a', 'b', 'c'],
      defaultModel: 'a',
      selectModel: (hints, { allowedModels }) => {
        // Pick the LAST matching hint instead of the first.
        const matches = hints
          .map((h) => h.name)
          .filter((n): n is string => typeof n === 'string')
          .filter((n) => (allowedModels ? allowedModels.includes(n) : true));
        return matches[matches.length - 1];
      },
    });
    const result = await handler(
      makeParams({ modelPreferences: { hints: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } }),
    );
    expect(result.model).toBe('c');
  });

  it('selectModel returning undefined falls back to defaultModel', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({
      llm,
      defaultModel: 'fallback',
      selectModel: () => undefined,
    });
    const result = await handler(makeParams({ modelPreferences: { hints: [{ name: 'x' }] } }));
    expect(result.model).toBe('fallback');
  });

  it('skips hint entries that have no name', async () => {
    const llm = makeLLM();
    const handler = createSamplingHandler({ llm, defaultModel: 'fallback' });
    const result = await handler(
      makeParams({
        modelPreferences: {
          hints: [{}, { name: 'picked' }],
        },
      }),
    );
    expect(result.model).toBe('picked');
  });
});

describe('createSamplingHandler — finish-reason mapping', () => {
  it('maps "stop" → "endTurn"', async () => {
    const handler = createSamplingHandler({ llm: makeLLM({ finishReason: 'stop' }) });
    const result = await handler(makeParams());
    expect(result.stopReason).toBe('endTurn');
  });

  it('maps "length" → "maxTokens"', async () => {
    const handler = createSamplingHandler({ llm: makeLLM({ finishReason: 'length' }) });
    const result = await handler(makeParams());
    expect(result.stopReason).toBe('maxTokens');
  });

  it('passes "tool_calls" through as the spec extensible string', async () => {
    const handler = createSamplingHandler({ llm: makeLLM({ finishReason: 'tool_calls' }) });
    const result = await handler(makeParams());
    expect(result.stopReason).toBe('tool_calls');
  });

  it('omits stopReason when finishReason is undefined', async () => {
    const llm: SamplingLLM = {
      chat: vi.fn(async () => ({
        content: 'hi',
        role: 'assistant' as const,
      })),
    };
    const handler = createSamplingHandler({ llm });
    const result = await handler(makeParams());
    expect(result.stopReason).toBeUndefined();
  });
});

describe('createSamplingHandler — observability + errors', () => {
  it('invokes onSamplingRequest with the resolved model + request summary', async () => {
    const onSamplingRequest = vi.fn();
    const handler = createSamplingHandler({
      llm: makeLLM(),
      defaultModel: 'gemma3',
      onSamplingRequest,
    });

    await handler(
      makeParams({
        systemPrompt: 'be helpful',
        messages: [
          { role: 'user', content: { type: 'text', text: 'a' } },
          { role: 'assistant', content: { type: 'text', text: 'b' } },
        ],
      }),
    );

    expect(onSamplingRequest).toHaveBeenCalledWith({
      model: 'gemma3',
      messageCount: 2,
      maxTokens: 256,
      systemPrompt: 'be helpful',
    });
  });

  it('propagates LLM errors to the caller', async () => {
    const llm: SamplingLLM = {
      chat: vi.fn(async () => {
        throw new Error('rate limited');
      }),
    };
    const handler = createSamplingHandler({ llm });
    await expect(handler(makeParams())).rejects.toThrow('rate limited');
  });
});

// ---------------------------------------------------------------------------
// Stage 6.1 — onEvent observability hook
// ---------------------------------------------------------------------------

describe('createSamplingHandler — onEvent', () => {
  it('emits mcp.sampling.create on success with model, counts, and namespace', async () => {
    const events: Array<Record<string, unknown>> = [];
    const llm = makeLLM();
    const handler = createSamplingHandler({
      llm,
      defaultModel: 'gemma3',
      namespace: 'content',
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    await handler(
      makeParams({
        messages: [
          { role: 'user', content: { type: 'text', text: 'one' } },
          { role: 'assistant', content: { type: 'text', text: 'two' } },
        ],
        maxTokens: 1024,
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'mcp.sampling.create',
      namespace: 'content',
      model: 'gemma3',
      messageCount: 2,
      maxTokens: 1024,
      success: true,
    });
    expect(typeof events[0]?.duration_ms).toBe('number');
  });

  it('omits namespace when none was configured on the handler', async () => {
    const events: Array<Record<string, unknown>> = [];
    const handler = createSamplingHandler({
      llm: makeLLM(),
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });
    await handler(makeParams());

    expect(events[0]).not.toHaveProperty('namespace');
  });

  it('emits mcp.sampling.create with success: false on LLM errors and rethrows', async () => {
    const events: Array<Record<string, unknown>> = [];
    const llm: SamplingLLM = {
      chat: vi.fn(async () => {
        throw new Error('rate limited');
      }),
    };
    const handler = createSamplingHandler({
      llm,
      defaultModel: 'gemma3',
      onEvent: (e) => events.push(e as unknown as Record<string, unknown>),
    });

    await expect(handler(makeParams())).rejects.toThrow('rate limited');

    expect(events[0]).toMatchObject({
      kind: 'mcp.sampling.create',
      model: 'gemma3',
      success: false,
      error: 'rate limited',
    });
  });

  it('is silent without onEvent', async () => {
    // No observable effect beyond not-throwing; but we verify the handler
    // still resolves normally with no sink attached.
    const handler = createSamplingHandler({ llm: makeLLM() });
    const result = await handler(makeParams());
    expect(result.role).toBe('assistant');
  });
});
