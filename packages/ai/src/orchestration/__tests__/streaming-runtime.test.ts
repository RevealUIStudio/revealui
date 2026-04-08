/**
 * StreamingAgentRuntime Tests
 *
 * Covers: streamTask() across text streaming, tool calls, deduplication,
 * abort signals, timeouts, max iterations, and stream errors.
 */

import { describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@revealui/core/monitoring', () => ({
  registerCleanupHandler: vi.fn(),
  unregisterCleanupHandler: vi.fn(),
}));

vi.mock('../../tools/mcp-adapter.js', () => ({
  discoverMCPTools: vi.fn().mockReturnValue([]),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import { z } from 'zod/v4';
import type { LLMClient } from '../../llm/client.js';
import type { LLMChunk } from '../../llm/providers/base.js';
import type { Tool, ToolResult } from '../../tools/base.js';
import type { Agent, Task } from '../agent.js';
import { type AgentStreamChunk, StreamingAgentRuntime } from '../streaming-runtime.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAgent(tools: Tool[] = []): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    tools,
    getContext: () => ({ agentId: 'agent-1' }),
  };
}

function makeTask(description = 'Do something'): Task {
  return { id: 'task-1', type: 'test', description };
}

function makeTool(name: string, result: ToolResult): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: z.object({ input: z.string().optional() }),
    execute: vi.fn().mockResolvedValue(result),
  };
}

/** Build an async generator that yields the given chunks. */
async function* chunksGen(chunks: LLMChunk[]): AsyncIterable<LLMChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function makeLLMClient(chunks: LLMChunk[]): LLMClient {
  return { stream: vi.fn().mockReturnValue(chunksGen(chunks)) } as unknown as LLMClient;
}

/** Collect all chunks from streamTask into an array. */
async function collect(gen: AsyncGenerator<AgentStreamChunk>): Promise<AgentStreamChunk[]> {
  const result: AgentStreamChunk[] = [];
  for await (const chunk of gen) {
    result.push(chunk);
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StreamingAgentRuntime.streamTask — text output', () => {
  it('yields text chunks and a done event when LLM returns text', async () => {
    const llm = makeLLMClient([
      { content: 'Hello', done: false },
      { content: ' world', done: true },
    ]);
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent(), makeTask(), llm));

    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks).toHaveLength(2);
    expect(textChunks[0].content).toBe('Hello');
    expect(textChunks[1].content).toBe(' world');

    const done = chunks.find((c) => c.type === 'done');
    expect(done).toBeDefined();
    expect(done?.content).toBe('Hello world');
    expect(done?.metadata?.executionTime).toBeTypeOf('number');
  });

  it('emits done with empty content when LLM returns empty text', async () => {
    const llm = makeLLMClient([{ content: '', done: true }]);
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent(), makeTask(), llm));

    expect(chunks.find((c) => c.type === 'done')).toBeDefined();
    expect(chunks.filter((c) => c.type === 'text')).toHaveLength(0);
  });
});

describe('StreamingAgentRuntime.streamTask — tool calls', () => {
  it('yields tool_call_start and tool_call_result, then completes on second LLM turn', async () => {
    const toolResult: ToolResult = { success: true, data: { answer: 42 } };
    const tool = makeTool('calculator', toolResult);

    // First LLM call: returns a tool call in the final done chunk
    const firstChunks: LLMChunk[] = [
      {
        content: '',
        done: true,
        toolCalls: [
          {
            id: 'tc-1',
            type: 'function',
            function: { name: 'calculator', arguments: '{"input":"2+2"}' },
          },
        ],
      },
    ];
    // Second LLM call: returns final text
    const secondChunks: LLMChunk[] = [{ content: 'The answer is 42', done: true }];

    const streamMock = vi
      .fn()
      .mockReturnValueOnce(chunksGen(firstChunks))
      .mockReturnValueOnce(chunksGen(secondChunks));

    const llm = { stream: streamMock } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent([tool]), makeTask(), llm));

    expect(
      chunks.some((c) => c.type === 'tool_call_start' && c.toolCall?.name === 'calculator'),
    ).toBe(true);
    expect(
      chunks.some((c) => c.type === 'tool_call_result' && c.toolResult?.success === true),
    ).toBe(true);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
    expect(tool.execute).toHaveBeenCalledOnce();
  });

  it('returns error tool result when tool is not found', async () => {
    const firstChunks: LLMChunk[] = [
      {
        content: '',
        done: true,
        toolCalls: [
          {
            id: 'tc-missing',
            type: 'function',
            function: { name: 'nonexistent_tool', arguments: '{}' },
          },
        ],
      },
    ];
    // After the failed tool call, LLM returns text
    const secondChunks: LLMChunk[] = [{ content: 'Could not use tool', done: true }];

    const streamMock = vi
      .fn()
      .mockReturnValueOnce(chunksGen(firstChunks))
      .mockReturnValueOnce(chunksGen(secondChunks));

    const llm = { stream: streamMock } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent([]), makeTask(), llm));

    const resultChunk = chunks.find((c) => c.type === 'tool_call_result');
    expect(resultChunk?.toolResult?.success).toBe(false);
    expect(resultChunk?.toolResult?.error).toMatch(/nonexistent_tool/);
  });

  it('deduplicates identical tool calls within the same run', async () => {
    const toolResult: ToolResult = { success: true, data: 'cached' };
    const tool = makeTool('expensive_op', toolResult);

    // Two identical tool calls in the same LLM response
    const firstChunks: LLMChunk[] = [
      {
        content: '',
        done: true,
        toolCalls: [
          {
            id: 'tc-a',
            type: 'function',
            function: { name: 'expensive_op', arguments: '{"input":"x"}' },
          },
          {
            id: 'tc-b',
            type: 'function',
            function: { name: 'expensive_op', arguments: '{"input":"x"}' },
          },
        ],
      },
    ];
    const secondChunks: LLMChunk[] = [{ content: 'Done', done: true }];

    const streamMock = vi
      .fn()
      .mockReturnValueOnce(chunksGen(firstChunks))
      .mockReturnValueOnce(chunksGen(secondChunks));

    const llm = { stream: streamMock } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    await collect(runtime.streamTask(makeAgent([tool]), makeTask(), llm));

    // Tool should only have been executed once (second call deduped)
    expect(tool.execute).toHaveBeenCalledOnce();
  });

  it('wraps tool execution errors in a failed ToolResult', async () => {
    const errorTool: Tool = {
      name: 'buggy_tool',
      description: 'always throws',
      parameters: z.object({}),
      execute: vi.fn().mockRejectedValue(new Error('tool exploded')),
    };

    const firstChunks: LLMChunk[] = [
      {
        content: '',
        done: true,
        toolCalls: [
          { id: 'tc-err', type: 'function', function: { name: 'buggy_tool', arguments: '{}' } },
        ],
      },
    ];
    const secondChunks: LLMChunk[] = [{ content: 'Recovered', done: true }];

    const streamMock = vi
      .fn()
      .mockReturnValueOnce(chunksGen(firstChunks))
      .mockReturnValueOnce(chunksGen(secondChunks));

    const llm = { stream: streamMock } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent([errorTool]), makeTask(), llm));

    const resultChunk = chunks.find((c) => c.type === 'tool_call_result');
    expect(resultChunk?.toolResult?.success).toBe(false);
    expect(resultChunk?.toolResult?.error).toContain('tool exploded');
  });
});

describe('StreamingAgentRuntime.streamTask — abort & timeout', () => {
  it('yields error:interrupted when AbortSignal is already aborted on entry', async () => {
    const controller = new AbortController();
    controller.abort();

    const llm = makeLLMClient([{ content: 'Should not yield', done: true }]);
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(
      runtime.streamTask(makeAgent(), makeTask(), llm, controller.signal),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ type: 'error', error: 'interrupted' });
  });

  it('yields error:interrupted when AbortSignal fires mid-stream', async () => {
    const controller = new AbortController();

    async function* slowStream(): AsyncIterable<LLMChunk> {
      yield { content: 'chunk1', done: false };
      // Abort while streaming
      controller.abort();
      yield { content: 'chunk2', done: true };
    }

    const llm = { stream: vi.fn().mockReturnValue(slowStream()) } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(
      runtime.streamTask(makeAgent(), makeTask(), llm, controller.signal),
    );

    expect(chunks.some((c) => c.type === 'error' && c.error === 'interrupted')).toBe(true);
  });

  it('yields timeout error when execution exceeds configured timeout between iterations', async () => {
    // The timeout is checked at the TOP of each iteration (not mid-stream).
    // Use a tool call so the first iteration completes and the second starts.
    // With timeout=1ms, by the time the async tool resolves and iteration 2 begins,
    // the elapsed time will exceed 1ms.
    const tool = makeTool('slow_tool', { success: true });
    const runtime = new StreamingAgentRuntime({ timeout: 1, maxIterations: 100 });

    // First call: returns a tool call so the loop continues
    const firstChunks: LLMChunk[] = [
      {
        content: '',
        done: true,
        toolCalls: [
          { id: 'tc-t', type: 'function', function: { name: 'slow_tool', arguments: '{}' } },
        ],
      },
    ];

    // Delay tool execution so the 1ms timeout is definitely exceeded
    (tool.execute as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ success: true }), 20)),
    );

    const streamMock = vi
      .fn()
      .mockReturnValueOnce(chunksGen(firstChunks))
      // Second call never reached due to timeout
      .mockReturnValue(chunksGen([{ content: 'Should not reach', done: true }]));

    const llm = { stream: streamMock } as unknown as LLMClient;
    const chunks = await collect(runtime.streamTask(makeAgent([tool]), makeTask(), llm));

    expect(chunks.some((c) => c.type === 'error' && c.error === 'Task execution timeout')).toBe(
      true,
    );
  });

  it('yields max iterations error when tool calls never resolve', async () => {
    const tool = makeTool('loop_tool', { success: true });
    const runtime = new StreamingAgentRuntime({ maxIterations: 2 });

    // Every LLM call always requests another tool call → never done
    const alwaysToolCall = (): AsyncIterable<LLMChunk> =>
      chunksGen([
        {
          content: '',
          done: true,
          toolCalls: [
            { id: 'tc-loop', type: 'function', function: { name: 'loop_tool', arguments: '{}' } },
          ],
        },
      ]);

    const llm = { stream: vi.fn().mockImplementation(alwaysToolCall) } as unknown as LLMClient;
    const chunks = await collect(runtime.streamTask(makeAgent([tool]), makeTask(), llm));

    const lastChunk = chunks.at(-1);
    expect(lastChunk?.type).toBe('error');
    expect(lastChunk?.error).toContain('Maximum iterations');
  });
});

describe('StreamingAgentRuntime.streamTask — stream errors', () => {
  it('yields error chunk when LLM stream throws', async () => {
    async function* throwingStream(): AsyncIterable<LLMChunk> {
      yield { content: 'start', done: false };
      throw new Error('network error');
    }

    const llm = { stream: vi.fn().mockReturnValue(throwingStream()) } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime();
    const chunks = await collect(runtime.streamTask(makeAgent(), makeTask(), llm));

    expect(chunks.some((c) => c.type === 'error' && c.error === 'network error')).toBe(true);
  });
});
