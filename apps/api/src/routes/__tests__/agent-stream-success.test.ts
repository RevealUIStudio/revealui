/**
 * Agent Stream — Success Path Tests
 *
 * The sibling agent-stream.test.ts mocks all @revealui/ai modules as {}
 * (truthy-but-constructor-less), testing only the 400/403 failure paths.
 *
 * This file mocks them with working implementations and also stubs
 * hono/streaming so the SSE callback runs synchronously in tests,
 * making it possible to verify chunk emission, early termination, error
 * propagation, LLM client selection, and workspaceId resolution.
 *
 * Constructor mock note: Vitest 4 requires `function` keyword (not arrow functions)
 * in mockImplementation when the mock is used as a constructor (`new`). Arrow
 * functions cannot be constructors in JavaScript. The biome-ignore comments below
 * prevent Biome from converting these back to arrow functions.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports (Vitest hoists vi.mock() calls)
// ---------------------------------------------------------------------------

/** Capture SSE events written by the route handler during each test. */
const capturedEvents: Array<{ event: string; data: string }> = [];

vi.mock('hono/streaming', () => ({
  /**
   * Stub streamSSE: runs the callback synchronously with a mock SSEStreamingApi,
   * collects the written events, and returns a 200 text/event-stream Response
   * whose body contains the SSE frames — so res.text() works in tests.
   */
  streamSSE: vi.fn().mockImplementation(
    async (
      _c: unknown,
      // biome-ignore lint/suspicious/noExplicitAny: SSE callback type from Hono
      callback: (stream: any) => Promise<void>,
    ) => {
      capturedEvents.length = 0;
      const mockStream = {
        writeSSE: vi.fn().mockImplementation(async (frame: { event?: string; data: string }) => {
          capturedEvents.push({ event: frame.event ?? '', data: frame.data });
        }),
        close: vi.fn(),
      };
      try {
        await callback(mockStream);
      } catch {
        // errors inside the callback are handled by the route's own try/catch
      }
      const body = capturedEvents.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join('');
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
  ),
}));

vi.mock('@revealui/ai', () => ({
  createLLMClientFromEnv: vi.fn().mockReturnValue({ type: 'env-client' }),
}));

vi.mock('@revealui/ai/llm/client', () => ({
  // biome-ignore lint/complexity/useArrowFunction: LLMClient is called with `new` — arrow functions cannot be constructors (Vitest 4)
  // biome-ignore lint/suspicious/noExplicitAny: mock constructor argument
  LLMClient: vi.fn().mockImplementation(function (cfg: any) {
    return { type: 'byok-client', ...cfg };
  }),
}));

vi.mock('@revealui/ai/orchestration/streaming-runtime', () => ({
  // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
  StreamingAgentRuntime: vi.fn().mockImplementation(function () {
    return {
      streamTask: vi.fn().mockImplementation(async function* () {
        yield { type: 'done', result: 'ok' };
      }),
    };
  }),
}));

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import agentStream from '../agent-stream.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono<{ Variables: { user?: { id: string; role: string } } }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'test-user', role: 'admin' });
    await next();
  });
  app.route('/agent-stream', agentStream);
  return app;
}

function createAppWithTenant(tenantId: string) {
  const app = new Hono<{
    Variables: { tenant?: { id: string }; user?: { id: string; role: string } };
  }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: 'test-user', role: 'admin' });
    c.set('tenant', { id: tenantId });
    await next();
  });
  app.route('/agent-stream', agentStream);
  return app;
}

function jsonPost(app: Hono, path: string, body: unknown, headers?: Record<string, string>) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

interface SseEvent {
  event: string;
  data: unknown;
}

function parseSse(text: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of text.split('\n\n')) {
    const lines = block.trim().split('\n');
    if (lines.length === 0 || !lines[0]) continue;
    const eventLine = lines.find((l) => l.startsWith('event:'));
    const dataLine = lines.find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    const event = eventLine?.slice('event:'.length).trim() ?? '';
    const rawData = dataLine.slice('data:'.length).trim();
    try {
      events.push({ event, data: JSON.parse(rawData) });
    } catch {
      // skip malformed frames
    }
  }
  return events;
}

/** Get the runtime mock returned for the most recent request. */
async function getRuntimeMock() {
  const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
  // mock.results holds the actual return values from mockImplementation.
  // mock.instances holds `this` (the raw prototype object), NOT the returned value
  // when the implementation explicitly returns an object.
  const results = vi.mocked(StreamingAgentRuntime).mock.results;
  return results[results.length - 1]!.value as { streamTask: ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// Per-test setup: restore mock implementations cleared by vi.clearAllMocks()
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();
  capturedEvents.length = 0;

  const { createLLMClientFromEnv } = await import('@revealui/ai');
  vi.mocked(createLLMClientFromEnv).mockReturnValue({ type: 'env-client' });

  const { LLMClient } = await import('@revealui/ai/llm/client');
  // biome-ignore lint/complexity/useArrowFunction: LLMClient is called with `new` — arrow functions cannot be constructors (Vitest 4)
  // biome-ignore lint/suspicious/noExplicitAny: mock constructor argument
  vi.mocked(LLMClient).mockImplementation(function (cfg: any) {
    return { type: 'byok-client', ...cfg };
  });

  const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
  // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
  vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
    return {
      streamTask: vi.fn().mockImplementation(async function* () {
        yield { type: 'done', result: 'ok' };
      }),
    };
  });

  // Restore the streamSSE stub (also cleared by clearAllMocks)
  const { streamSSE } = await import('hono/streaming');
  vi.mocked(streamSSE).mockImplementation(async (_c, callback) => {
    capturedEvents.length = 0;
    const mockStream = {
      writeSSE: vi.fn().mockImplementation(async (frame: { event?: string; data: string }) => {
        capturedEvents.push({ event: frame.event ?? '', data: frame.data });
      }),
      close: vi.fn(),
    };
    try {
      // biome-ignore lint/suspicious/noExplicitAny: mock stream type
      await callback(mockStream as any);
    } catch {
      // errors handled by route's own try/catch
    }
    const body = capturedEvents.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join('');
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agent-stream — success path (AI modules working)', () => {
  // ── Response shape ────────────────────────────────────────────────────────

  it('returns 200 with text/event-stream content-type', async () => {
    const app = createApp();
    const res = await jsonPost(app, '/agent-stream', { instruction: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('emits one SSE frame per chunk with matching event type', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        streamTask: vi.fn().mockImplementation(async function* () {
          yield { type: 'thinking', content: 'Working…' };
          yield { type: 'token', content: 'Hello' };
          yield { type: 'done', result: 'Hello World' };
        }),
      };
    });

    const app = createApp();
    const res = await jsonPost(app, '/agent-stream', { instruction: 'Say hello' });

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    expect(events).toHaveLength(3);
    expect(events[0]!.event).toBe('thinking');
    expect(events[1]!.event).toBe('token');
    expect(events[2]!.event).toBe('done');
  });

  it('includes the full chunk object in each SSE data field', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        streamTask: vi.fn().mockImplementation(async function* () {
          yield { type: 'token', content: 'Hi', index: 0 };
          yield { type: 'done', result: 'Hi', totalTokens: 5 };
        }),
      };
    });

    const app = createApp();
    const events = parseSse(
      await (await jsonPost(app, '/agent-stream', { instruction: 'Hi' })).text(),
    );

    expect(events[0]!.data).toMatchObject({ type: 'token', content: 'Hi', index: 0 });
    expect(events[1]!.data).toMatchObject({ type: 'done', result: 'Hi', totalTokens: 5 });
  });

  // ── Termination conditions ────────────────────────────────────────────────

  it('stops emitting after the first "done" chunk', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        streamTask: vi.fn().mockImplementation(async function* () {
          yield { type: 'token', content: 'A' };
          yield { type: 'done', result: 'finished' };
          yield { type: 'token', content: 'never' }; // must not appear
        }),
      };
    });

    const app = createApp();
    const events = parseSse(
      await (await jsonPost(app, '/agent-stream', { instruction: '' })).text(),
    );

    expect(events).toHaveLength(2);
    expect(events[events.length - 1]!.event).toBe('done');
  });

  it('stops emitting after the first "error" chunk from the generator', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        streamTask: vi.fn().mockImplementation(async function* () {
          yield { type: 'error', error: 'LLM returned bad response' };
          yield { type: 'token', content: 'orphan' }; // must not appear
        }),
      };
    });

    const app = createApp();
    const events = parseSse(
      await (await jsonPost(app, '/agent-stream', { instruction: 'crash' })).text(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('error');
  });

  it('emits an error SSE event when streamTask throws', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        streamTask: vi.fn().mockImplementation(async function* () {
          yield { type: 'thinking', content: 'Starting…' };
          throw new Error('LLM timeout after 30s');
        }),
      };
    });

    const app = createApp();
    const res = await jsonPost(app, '/agent-stream', { instruction: 'Crash me' });

    expect(res.status).toBe(200);
    const events = parseSse(await res.text());
    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    const data = errorEvent!.data as { type: string; error: string };
    expect(data.type).toBe('error');
    expect(data.error).toContain('LLM timeout after 30s');
  });

  it('emits "Unknown error" in SSE when a non-Error is thrown', async () => {
    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    // biome-ignore lint/complexity/useArrowFunction: StreamingAgentRuntime is called with `new` — arrow functions cannot be constructors (Vitest 4)
    vi.mocked(StreamingAgentRuntime).mockImplementation(function () {
      return {
        // biome-ignore lint/correctness/useYield: intentionally yields nothing — tests the thrown-non-Error catch path
        streamTask: vi.fn().mockImplementation(async function* () {
          throw 'string-error'; // not an Error instance
        }),
      };
    });

    const app = createApp();
    const events = parseSse(
      await (await jsonPost(app, '/agent-stream', { instruction: 'throw' })).text(),
    );

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent!.data as { error: string }).error).toBe('Unknown error');
  });

  // ── LLM client selection ──────────────────────────────────────────────────

  it('calls createLLMClientFromEnv when no Authorization header is present', async () => {
    const { createLLMClientFromEnv } = await import('@revealui/ai');
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'env path' });

    expect(vi.mocked(createLLMClientFromEnv)).toHaveBeenCalledOnce();
  });

  it('constructs BYOK LLMClient with correct provider and apiKey for sk-ant- prefix', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'byok anthropic' },
      { Authorization: 'Bearer sk-ant-api03-realkey' },
    );

    expect(vi.mocked(LLMClient)).toHaveBeenCalledOnce();
    const args = vi.mocked(LLMClient).mock.calls[0]![0] as {
      provider: string;
      apiKey: string;
      model: string;
    };
    expect(args.provider).toBe('anthropic');
    expect(args.apiKey).toBe('sk-ant-api03-realkey');
  });

  it('constructs BYOK LLMClient with correct provider for sk- (openai) prefix', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'byok openai' },
      { Authorization: 'Bearer sk-proj-openaiapikey' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { provider: string };
    expect(args.provider).toBe('openai');
  });

  it('constructs BYOK LLMClient with correct provider for gsk_ (groq) prefix', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'byok groq' },
      { Authorization: 'Bearer gsk_mygroqkey' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { provider: string };
    expect(args.provider).toBe('groq');
  });

  // ── Model selection ───────────────────────────────────────────────────────

  it('uses the default model for openai (gpt-4o) when model is not specified', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'default model' },
      { Authorization: 'Bearer sk-proj-testkey' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { model: string };
    expect(args.model).toBe('gpt-4o');
  });

  it('uses the default model for groq (llama-3.3-70b-versatile) when model is not specified', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'groq default' },
      { Authorization: 'Bearer gsk_groqkey' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { model: string };
    expect(args.model).toBe('llama-3.3-70b-versatile');
  });

  it('uses body.model when provided, overriding the default', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'custom model', model: 'gpt-4o-mini' },
      { Authorization: 'Bearer sk-proj-testkey' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { model: string };
    expect(args.model).toBe('gpt-4o-mini');
  });

  it('uses explicit provider from body, overriding key-prefix detection', async () => {
    const { LLMClient } = await import('@revealui/ai/llm/client');
    const app = createApp();

    // sk-ant- would normally resolve to 'anthropic', but explicit 'groq' wins
    await jsonPost(
      app,
      '/agent-stream',
      { instruction: 'override provider', provider: 'groq' },
      { Authorization: 'Bearer sk-ant-api03-key' },
    );

    const args = vi.mocked(LLMClient).mock.calls[0]![0] as { provider: string };
    expect(args.provider).toBe('groq');
  });

  // ── workspaceId resolution ────────────────────────────────────────────────

  it('passes workspaceId from request body to the agent instructions', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'ws test', workspaceId: 'ws-custom-99' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.instructions).toContain('ws-custom-99');
  });

  it('falls back to tenant context workspaceId when body.workspaceId is absent', async () => {
    const app = createAppWithTenant('tenant-abc');
    await jsonPost(app, '/agent-stream', { instruction: 'tenant ws' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.instructions).toContain('tenant-abc');
  });

  it('falls back to "default" workspaceId when neither body nor tenant context is set', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'no workspace' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.instructions).toContain('default');
  });

  // ── Task identity ─────────────────────────────────────────────────────────

  it('sets task description to the instruction and type to "instruction"', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'Summarise the quarterly report' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing task argument from dynamic mock
    const taskArg = runtime.streamTask.mock.calls[0]?.[1] as any;
    expect(taskArg.description).toBe('Summarise the quarterly report');
    expect(taskArg.type).toBe('instruction');
  });

  it('generates a unique task id prefixed with "task-" for each request', async () => {
    const app = createApp();

    await jsonPost(app, '/agent-stream', { instruction: 'first' });
    await jsonPost(app, '/agent-stream', { instruction: 'second' });

    const { StreamingAgentRuntime } = await import('@revealui/ai/orchestration/streaming-runtime');
    const results = vi.mocked(StreamingAgentRuntime).mock.results;

    // biome-ignore lint/suspicious/noExplicitAny: capturing task argument from dynamic mock
    const task1 = (results[0]!.value as any).streamTask.mock.calls[0]?.[1];
    // biome-ignore lint/suspicious/noExplicitAny: capturing task argument from dynamic mock
    const task2 = (results[1]!.value as any).streamTask.mock.calls[0]?.[1];

    expect(task1.id).toMatch(/^task-\d+$/);
    expect(task2.id).toMatch(/^task-\d+$/);
    expect(typeof task1.id).toBe('string');
    expect(typeof task2.id).toBe('string');
  });

  // ── Mode parameter ──────────────────────────────────────────────────────

  it('uses CMS agent identity when mode is "cms"', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'List posts', mode: 'cms' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.id).toBe('cms-stream-agent');
    expect(agentArg.name).toBe('CMS Stream Agent');
    expect(agentArg.instructions).toContain('CMS management');
    expect(agentArg.instructions).not.toContain('coding tools');
  });

  it('uses coding agent identity when mode is "coding"', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'Show files', mode: 'coding' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.id).toBe('coding-stream-agent');
    expect(agentArg.name).toBe('Coding Agent');
    expect(agentArg.instructions).toContain('coding and CMS');
    expect(agentArg.instructions).toContain('coding tools');
  });

  it('defaults to CMS agent when mode is omitted', async () => {
    const app = createApp();
    await jsonPost(app, '/agent-stream', { instruction: 'Hello' });

    const runtime = await getRuntimeMock();
    // biome-ignore lint/suspicious/noExplicitAny: capturing agent argument from dynamic mock
    const agentArg = runtime.streamTask.mock.calls[0]?.[0] as any;
    expect(agentArg.id).toBe('cms-stream-agent');
  });
});
