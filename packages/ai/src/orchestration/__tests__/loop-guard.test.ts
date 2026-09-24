/**
 * Studio LoopGuard wire for AgentRuntime and StreamingAgentRuntime.
 *
 * No daemon: the task finishes as before.
 * Mock daemon: loop.arm, loop.tick, and loop.stop run, and three
 * non-advancing ticks stop the interactive loop (daemon no-op limit).
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { LLMClient } from '../../llm/client.js';
import type { LLMChunk, LLMResponse } from '../../llm/providers/base.js';
import type { Tool, ToolResult } from '../../tools/base.js';
import type { Agent, Task } from '../agent.js';
import {
  createDaemonLoopGuard,
  DAEMON_LOOP_INTERVAL_MS,
  DAEMON_LOOP_NOOP_LIMIT,
  iterationAdvanced,
  PRODUCT_RUNTIME_ACTOR_ID,
} from '../loop-guard.js';
import { AgentRuntime } from '../runtime.js';
import { StreamingAgentRuntime } from '../streaming-runtime.js';

vi.mock('@revealui/core/monitoring', () => ({
  registerCleanupHandler: vi.fn(),
  unregisterCleanupHandler: vi.fn(),
}));

vi.mock('../../tools/mcp-adapter.js', () => ({
  createToolsFromMcpClient: vi.fn().mockResolvedValue([]),
}));

interface RpcFrame {
  method: string;
  params: Record<string, unknown>;
}

interface LoopServer {
  socketPath: string;
  calls: RpcFrame[];
  close: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const close = cleanups.pop();
    if (close) await close();
  }
});

function makeAgent(tools: Tool[] = []): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    tools,
    getContext: () => ({ agentId: 'agent-1' }),
  };
}

function makeTask(): Task {
  return { id: 'task-1', type: 'test', description: 'Do the thing' };
}

function textResponse(): LLMResponse {
  return {
    content: 'Done.',
    role: 'assistant',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  };
}

function missingToolResponse(): LLMResponse {
  return {
    content: '',
    role: 'assistant',
    toolCalls: [
      {
        id: 'tc-1',
        type: 'function',
        function: { name: 'missing_tool', arguments: '{}' },
      },
    ],
  };
}

function chatClient(response: LLMResponse): LLMClient {
  return {
    chat: vi.fn(async () => response),
  } as unknown as LLMClient;
}

async function* chunksGen(chunks: LLMChunk[]): AsyncIterable<LLMChunk> {
  for (const chunk of chunks) yield chunk;
}

function listen(server: Server, socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function startLoopServer(
  onCall: (frame: RpcFrame, index: number) => unknown,
): Promise<LoopServer> {
  const dir = await mkdtemp(join(tmpdir(), 'loop-guard-'));
  const socketPath = join(dir, 'h.sock');
  const calls: RpcFrame[] = [];
  const sockets: Socket[] = [];
  const server = createServer((socket) => {
    sockets.push(socket);
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const parsed = JSON.parse(line) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
      };
      const frame: RpcFrame = {
        method: parsed.method ?? '',
        params: parsed.params ?? {},
      };
      calls.push(frame);
      const result = onCall(frame, calls.length - 1);
      socket.write(`${JSON.stringify({ jsonrpc: '2.0', id: parsed.id ?? 1, result })}\n`);
    });
  });
  await listen(server, socketPath);
  const close = async (): Promise<void> => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await rm(dir, { recursive: true, force: true });
  };
  cleanups.push(close);
  return { socketPath, calls, close };
}

function armedResult(): { loop: { status: string; lastSignal: null } } {
  return { loop: { status: 'armed', lastSignal: null } };
}

describe('iterationAdvanced', () => {
  it('treats a finished answer and a new tool call as progress', () => {
    expect(iterationAdvanced({ completed: true, newToolExecutions: 0 })).toBe(true);
    expect(iterationAdvanced({ completed: false, newToolExecutions: 1 })).toBe(true);
    expect(iterationAdvanced({ completed: false, newToolExecutions: 0 })).toBe(false);
  });

  it('documents the daemon no-op limit of 3', () => {
    expect(DAEMON_LOOP_NOOP_LIMIT).toBe(3);
    expect(DAEMON_LOOP_INTERVAL_MS).toBe(60_000);
  });
});

describe('AgentRuntime LoopGuard', () => {
  it('finishes when no daemon socket exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loop-absent-'));
    cleanups.push(async () => {
      await rm(dir, { recursive: true, force: true });
    });
    const runtime = new AgentRuntime({
      loopGuard: createDaemonLoopGuard({
        socketPath: join(dir, 'missing.sock'),
        timeoutMs: 50,
      }),
    });
    const llm = chatClient(textResponse());
    const result = await runtime.executeTask(makeAgent(), makeTask(), llm);
    expect(result.success).toBe(true);
    expect(result.output).toBe('Done.');
    expect(llm.chat).toHaveBeenCalledOnce();
  });

  it('finishes when the socket path is not a daemon', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loop-dead-'));
    cleanups.push(async () => {
      await rm(dir, { recursive: true, force: true });
    });
    const socketPath = join(dir, 'not-a-sock');
    await writeFile(socketPath, 'stale');
    const runtime = new AgentRuntime({
      loopGuard: createDaemonLoopGuard({ socketPath, timeoutMs: 80 }),
    });
    const result = await runtime.executeTask(makeAgent(), makeTask(), chatClient(textResponse()));
    expect(result.success).toBe(true);
    expect(result.output).toBe('Done.');
  });

  it('bounds a silent daemon and still finishes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loop-silent-'));
    const socketPath = join(dir, 'h.sock');
    const open: Socket[] = [];
    const server = createServer((socket) => {
      open.push(socket);
    });
    await listen(server, socketPath);
    cleanups.push(async () => {
      for (const socket of open) socket.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await rm(dir, { recursive: true, force: true });
    });
    const runtime = new AgentRuntime({
      loopGuard: createDaemonLoopGuard({ socketPath, timeoutMs: 80 }),
    });
    const started = Date.now();
    const result = await runtime.executeTask(makeAgent(), makeTask(), chatClient(textResponse()));
    expect(result.success).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it('arms, ticks spend, and stops when the daemon answers', async () => {
    const server = await startLoopServer(() => armedResult());
    const runtime = new AgentRuntime({
      model: 'gpt-4o-mini',
      loopGuard: createDaemonLoopGuard({
        socketPath: server.socketPath,
        actorAgentId: 'studio-agent',
        timeoutMs: 500,
      }),
    });
    const result = await runtime.executeTask(makeAgent(), makeTask(), chatClient(textResponse()));
    expect(result.success).toBe(true);
    expect(server.calls.map((call) => call.method)).toEqual(['loop.arm', 'loop.tick', 'loop.stop']);
    const arm = server.calls[0]?.params;
    expect(arm?.intervalMs).toBe(DAEMON_LOOP_INTERVAL_MS);
    expect(arm?.actorAgentId).toBe('studio-agent');
    expect(arm?.noopLimit).toBeUndefined();
    expect(typeof arm?.loopId).toBe('string');
    const tick = server.calls[1]?.params;
    expect(tick?.advanced).toBe(true);
    expect(tick?.tokensIn).toBe(100);
    expect(tick?.tokensOut).toBe(50);
    expect(tick?.costMicros).toBe(45);
    expect(tick?.loopId).toBe(arm?.loopId);
    expect(server.calls[2]?.params.loopId).toBe(arm?.loopId);
  });

  it('reads the cached Studio session id when no actor override is set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loop-actor-'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${process.pid}.id`), 'cached-studio-agent\n');
    const previous = process.env.REVDEV_DAEMON_SESSION_DIR;
    process.env.REVDEV_DAEMON_SESSION_DIR = dir;
    cleanups.push(async () => {
      if (previous === undefined) delete process.env.REVDEV_DAEMON_SESSION_DIR;
      else process.env.REVDEV_DAEMON_SESSION_DIR = previous;
      await rm(dir, { recursive: true, force: true });
    });
    const server = await startLoopServer(() => armedResult());
    const runtime = new AgentRuntime({
      loopGuard: createDaemonLoopGuard({ socketPath: server.socketPath, timeoutMs: 500 }),
    });
    await runtime.executeTask(makeAgent(), makeTask(), chatClient(textResponse()));
    expect(server.calls[0]?.params.actorAgentId).toBe('cached-studio-agent');
  });

  it('stops after the daemon reports not_advancing', async () => {
    let misses = 0;
    const server = await startLoopServer((frame) => {
      if (frame.method !== 'loop.tick') return armedResult();
      if (frame.params.advanced === false) misses += 1;
      if (misses >= DAEMON_LOOP_NOOP_LIMIT) {
        return { loop: { status: 'not_advancing', lastSignal: 'loop not advancing' } };
      }
      return armedResult();
    });
    const llm = chatClient(missingToolResponse());
    const runtime = new AgentRuntime({
      maxIterations: 10,
      loopGuard: createDaemonLoopGuard({ socketPath: server.socketPath, timeoutMs: 500 }),
    });
    const result = await runtime.executeTask(makeAgent(), makeTask(), llm);
    expect(result.success).toBe(false);
    expect(result.error).toBe('loop not advancing');
    expect(llm.chat).toHaveBeenCalledTimes(DAEMON_LOOP_NOOP_LIMIT);
    expect(server.calls.filter((call) => call.method === 'loop.tick')).toHaveLength(
      DAEMON_LOOP_NOOP_LIMIT,
    );
    expect(server.calls.at(-1)?.method).toBe('loop.stop');
    expect(server.calls[0]?.params.actorAgentId).toBe(PRODUCT_RUNTIME_ACTOR_ID);
  });

  it('does not call the daemon when loopGuard is false', async () => {
    const server = await startLoopServer(() => armedResult());
    const runtime = new AgentRuntime({ loopGuard: false });
    const result = await runtime.executeTask(makeAgent(), makeTask(), chatClient(textResponse()));
    expect(result.success).toBe(true);
    expect(server.calls).toHaveLength(0);
  });
});

describe('StreamingAgentRuntime LoopGuard', () => {
  it('finishes when no daemon socket exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loop-stream-absent-'));
    cleanups.push(async () => {
      await rm(dir, { recursive: true, force: true });
    });
    const runtime = new StreamingAgentRuntime({
      loopGuard: createDaemonLoopGuard({
        socketPath: join(dir, 'missing.sock'),
        timeoutMs: 50,
      }),
    });
    const llm = {
      stream: vi.fn(() => chunksGen([{ content: 'Hello', done: true }])),
    } as unknown as LLMClient;
    const chunks = [];
    for await (const chunk of runtime.streamTask(makeAgent(), makeTask(), llm)) {
      chunks.push(chunk);
    }
    expect(chunks.some((chunk) => chunk.type === 'done')).toBe(true);
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
  });

  it('arms, ticks, and stops a streamed answer', async () => {
    const server = await startLoopServer(() => armedResult());
    const runtime = new StreamingAgentRuntime({
      loopGuard: createDaemonLoopGuard({
        socketPath: server.socketPath,
        actorAgentId: 'stream-agent',
        timeoutMs: 500,
      }),
    });
    const llm = {
      stream: vi.fn(() => chunksGen([{ content: 'Hello', done: true }])),
    } as unknown as LLMClient;
    const chunks = [];
    for await (const chunk of runtime.streamTask(makeAgent(), makeTask(), llm)) {
      chunks.push(chunk);
    }
    expect(chunks.some((chunk) => chunk.type === 'done' && chunk.content === 'Hello')).toBe(true);
    expect(server.calls.map((call) => call.method)).toEqual(['loop.arm', 'loop.tick', 'loop.stop']);
    expect(server.calls[1]?.params.advanced).toBe(true);
    expect(server.calls[0]?.params.actorAgentId).toBe('stream-agent');
  });

  it('stops a non-advancing stream when the daemon says so', async () => {
    let misses = 0;
    const server = await startLoopServer((frame) => {
      if (frame.method !== 'loop.tick') return armedResult();
      if (frame.params.advanced === false) misses += 1;
      if (misses >= DAEMON_LOOP_NOOP_LIMIT) {
        return { loop: { status: 'not_advancing', lastSignal: 'loop not advancing' } };
      }
      return armedResult();
    });
    const tool: Tool = {
      name: 'echo',
      description: 'echo',
      parameters: z.object({}),
      execute: vi.fn(async (): Promise<ToolResult> => ({ success: true, content: 'ok' })),
    };
    let turn = 0;
    const llm = {
      stream: vi.fn(() => {
        turn += 1;
        if (turn === 1) {
          return chunksGen([
            {
              content: '',
              done: true,
              toolCalls: [
                {
                  id: 'tc-1',
                  type: 'function',
                  function: { name: 'echo', arguments: '{}' },
                },
              ],
            },
          ]);
        }
        return chunksGen([
          {
            content: '',
            done: true,
            toolCalls: [
              {
                id: `tc-${turn}`,
                type: 'function',
                function: { name: 'missing_tool', arguments: '{}' },
              },
            ],
          },
        ]);
      }),
    } as unknown as LLMClient;
    const runtime = new StreamingAgentRuntime({
      maxIterations: 10,
      loopGuard: createDaemonLoopGuard({ socketPath: server.socketPath, timeoutMs: 500 }),
    });
    const chunks = [];
    for await (const chunk of runtime.streamTask(makeAgent([tool]), makeTask(), llm)) {
      chunks.push(chunk);
    }
    expect(chunks.at(-1)).toMatchObject({ type: 'error', error: 'loop not advancing' });
    const ticks = server.calls.filter((call) => call.method === 'loop.tick');
    expect(ticks[0]?.params.advanced).toBe(true);
    expect(ticks.slice(1).every((tick) => tick.params.advanced === false)).toBe(true);
    expect(ticks.filter((tick) => tick.params.advanced === false)).toHaveLength(
      DAEMON_LOOP_NOOP_LIMIT,
    );
    expect(server.calls.at(-1)?.method).toBe('loop.stop');
  });
});
