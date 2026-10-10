import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexAdapter, type CodexAdapterConfig } from '../adapters/codex-adapter.js';
import { writeManagerAdapterContent } from '../content/write-manager-adapters.js';
import { materializeManager, writeManager } from '../manager/materialize.js';
import { ManagerSchema } from '../manager/schema.js';
import * as boundary from '../session/boundary.js';
import { studioLocalKnowledgeGraphMcpServer } from '../session/studio-local-kg-mcp.js';
import type { HarnessEvent } from '../types/core.js';

const roots: string[] = [];
const adapters: CodexAdapter[] = [];
afterEach(async () => {
  await Promise.all(adapters.splice(0).map((adapter) => adapter.dispose()));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Synthetic wire peer exercises the real process/pipe/termination boundary. */
function fixture(mode = 'complete', config: CodexAdapterConfig = {}) {
  const root = mkdtempSync(join(tmpdir(), 'codex-adapter-'));
  roots.push(root);
  const binary = join(root, 'codex.cjs');
  const trace = join(root, 'wire.jsonl');
  writeFileSync(
    binary,
    `#!/usr/bin/env node
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const mode = ${JSON.stringify(mode)}, trace = ${JSON.stringify(trace)};
function record(value) { fs.appendFileSync(trace, JSON.stringify(value) + '\\n'); }
if (process.argv.includes('--version')) { console.log('codex-cli 0.160.0'); process.exit(0); }
if (process.argv.includes('--help')) { console.log('app-server --listen stdio://'); process.exit(0); }
record({ pid: process.pid, args: process.argv.slice(2) });
if (mode === 'ignore-interrupt') process.on('SIGTERM', () => {});
function send(value) { process.stdout.write(JSON.stringify(value) + '\\n'); }
function notify(method, params) { send({ method, params: { threadId: 'thread1', turnId: 'turn1', ...params } }); }
function complete(status = 'completed') { notify('turn/completed', { turn: { id: 'turn1', status, items: [], error: status === 'failed' ? { message: 'inference failed' } : null } }); }
readline.createInterface({ input: process.stdin }).on('line', line => {
  const msg = JSON.parse(line); record(msg);
  if (!msg.method) {
    if (msg.id === 'approval') { complete(msg.result?.decision === 'decline' ? 'failed' : 'completed'); }
    if (msg.id === 'unknown') { complete(msg.error ? 'failed' : 'completed'); }
    return;
  }
  if (msg.method === 'initialize') {
    if (mode === 'startup-hang') return;
    if (mode === 'malformed') { process.stdout.write('not JSON\\n'); return; }
    if (mode === 'rpc-error') { send({ id: msg.id, error: { code: -1, message: 'initialize rejected' } }); return; }
    const response = JSON.stringify({ id: msg.id, result: {} }) + '\\n';
    process.stdout.write(response.slice(0, 5));
    setTimeout(() => process.stdout.write(response.slice(5)), 5);
  }
  if (msg.method === 'thread/read') send({ id: msg.id, result: { thread: { id: 'thread1', cwd: mode === 'wrong-root' ? '/' : ${JSON.stringify(root)} } } });
  if (msg.method === 'thread/start' || msg.method === 'thread/resume') {
    if (mode === 'resume-error' || mode === 'mcp-error') { send({ id: msg.id, error: { message: 'thread initialization failed' } }); return; }
    send({ id: msg.id, result: { thread: { id: 'thread1' } } });
  }
  if (msg.method === 'mcpServer/tool/call') {
    if (mode === 'memory-hold') return;
    send({ id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify({ status: 'ok', available: true, enforcement: 'enforced', deniedCount: 0, data: { nodes: [], facts: [] } }) }], isError: false } });
  }
  if (msg.method === 'turn/start') {
    if (mode === 'close') { process.exit(7); }
    if (mode === 'overflow') { process.stdout.write('x'.repeat(11 * 1024 * 1024)); return; }
    notify('turn/started', { turn: { id: 'turn1', status: 'inProgress' } });
    if (mode !== 'early-complete' && mode !== 'pending-start') send({ id: msg.id, result: { turn: { id: 'turn1', status: 'inProgress' } } });
    if (mode === 'failed') { complete('failed'); return; }
    if (mode === 'interrupted') { complete('interrupted'); return; }
    if (['approval', 'file-approval', 'foreign-approval', 'resolved-approval', 'grant-root'].includes(mode)) {
      send({ id: 'approval', method: mode === 'file-approval' || mode === 'grant-root' ? 'item/fileChange/requestApproval' : 'item/commandExecution/requestApproval', params: {
        threadId: mode === 'foreign-approval' ? 'foreign' : 'thread1', turnId: 'turn1', itemId: 'item1', command: 'echo hello',
        ...(mode === 'grant-root' ? { grantRoot: '/' } : {})
      } });
      if (mode === 'resolved-approval') {
        notify('serverRequest/resolved', { requestId: 'approval' });
        complete('failed');
      }
      return;
    }
    if (mode === 'unknown-request') { send({ id: 'unknown', method: 'item/permissions/requestApproval', params: { threadId: 'thread1', turnId: 'turn1' } }); return; }
    if (mode === 'descendant') {
      const descendant = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)']);
      record({ descendant: descendant.pid });
    }
    notify('item/agentMessage/delta', { threadId: 'other-thread', itemId: 'foreign', delta: 'must be ignored' });
    notify('item/agentMessage/delta', { itemId: 'answer', delta: 'ready' });
    if (mode === 'hold' || mode === 'ignore-interrupt' || mode === 'pending-start') return;
    notify('item/completed', { item: { id: 'commentary', type: 'agentMessage', phase: 'commentary', text: 'Working...' } });
    notify('item/completed', { item: { id: 'answer', type: 'agentMessage', phase: 'final_answer', text: 'Final π answer' } });
    complete();
  }
  if (msg.method === 'turn/interrupt') {
    send({ id: msg.id, result: {} });
    if (mode !== 'ignore-interrupt') complete('interrupted');
  }
});
`,
  );
  chmodSync(binary, 0o755);
  const adapter = new CodexAdapter({
    binaryPath: binary,
    projectRoot: root,
    timeoutMs: 15_000,
    model: 'configured-model',
    reasoningEffort: 'low',
    ...config,
  });
  adapters.push(adapter);
  const events: HarnessEvent[] = [];
  adapter.onEvent((event) => events.push(event));
  const messages = () =>
    readFileSync(trace, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  return { adapter, events, messages, root, trace };
}

function waitForEvent(
  adapter: CodexAdapter,
  events: HarnessEvent[],
  type: HarnessEvent['type'],
): Promise<void> {
  if (events.some((event) => event.type === type)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const unsubscribe = adapter.onEvent((event) => {
      if (event.type === type) {
        unsubscribe();
        resolve();
      } else if (event.type === 'generation-failed' || event.type === 'generation-cancelled') {
        unsubscribe();
        reject(new Error(event.message));
      }
    });
  });
}

describe('Codex app-server adapter', () => {
  it('dispatches over the stable handshake, scopes streams, and uses authoritative final output', async () => {
    const { adapter, events, messages } = fixture();
    expect(await adapter.isAvailable()).toBe(true);
    const result = await adapter.execute({ type: 'headless-prompt', prompt: 'hello' });
    expect(result).toMatchObject({
      success: true,
      message: 'Final π answer',
      data: { threadId: 'thread1', turnId: 'turn1', status: 'completed' },
    });
    expect(events[0].type).toBe('generation-started');
    expect(events.at(-1)?.type).toBe('generation-completed');
    expect(events.filter((event) => event.type === 'generation-progress')).toEqual([
      expect.objectContaining({ delta: 'ready' }),
    ]);
    const wire = messages();
    expect(wire[0].args).toEqual(['app-server', '--listen', 'stdio://']);
    expect(wire.filter((entry) => entry.method).map((entry) => entry.method)).toEqual([
      'initialize',
      'initialized',
      'thread/start',
      'turn/start',
    ]);
    expect(wire.find((entry) => entry.method === 'initialize').params.clientInfo.name).toBe(
      'revealfleet',
    );
    expect(wire.find((entry) => entry.method === 'thread/start').params).toMatchObject({
      sandbox: 'read-only',
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      model: 'configured-model',
    });
    expect(wire.find((entry) => entry.method === 'turn/start').params).toMatchObject({
      effort: 'low',
      input: [{ type: 'text', text: 'hello' }],
    });
    expect(() => process.kill(wire[0].pid, 0)).toThrow();
  });

  it('resumes by id after checking project ownership, retaining explicit sandbox and MCP configuration', async () => {
    const { adapter, messages } = fixture('complete', {
      mcpServers: [studioLocalKnowledgeGraphMcpServer()],
    });
    expect(
      (await adapter.execute({ type: 'headless-prompt', prompt: 'continue', threadId: 'thread1' }))
        .success,
    ).toBe(true);
    const wire = messages();
    expect(wire.some((entry) => entry.method === 'thread/start')).toBe(false);
    expect(wire.find((entry) => entry.method === 'thread/read').params).toEqual({
      threadId: 'thread1',
      includeTurns: false,
    });
    expect(wire.find((entry) => entry.method === 'thread/resume').params).toMatchObject({
      threadId: 'thread1',
      sandbox: 'read-only',
      approvalPolicy: 'on-request',
      config: {
        'mcp_servers.knowledge-graph': {
          command: 'revealui-mcp',
          args: ['knowledge-graph'],
          enabled: true,
          required: true,
        },
      },
    });
  });

  it.each(['wrong-root', 'resume-error'])(
    'rejects %s without silently starting a fresh thread',
    async (mode) => {
      const { adapter, messages } = fixture(mode);
      expect(
        (
          await adapter.execute({
            type: 'headless-prompt',
            prompt: 'continue',
            threadId: 'thread1',
          })
        ).success,
      ).toBe(false);
      expect(
        messages().some((entry) => ['thread/start', 'turn/start'].includes(entry.method)),
      ).toBe(false);
    },
  );

  it('does not dispatch when a required MCP server fails initialization', async () => {
    const { adapter, messages } = fixture('mcp-error', {
      mcpServers: [studioLocalKnowledgeGraphMcpServer()],
    });
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      false,
    );
    expect(messages().some((entry) => entry.method === 'turn/start')).toBe(false);
  });

  it.each(['approval', 'file-approval'])(
    'routes %s to the host with a request-scoped decision',
    async (mode) => {
      let seen: unknown;
      const { adapter, messages } = fixture(mode, {
        onApproval: (request) => {
          seen = request;
          return 'accept';
        },
      });
      expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
        true,
      );
      expect(seen).toMatchObject({
        requestId: 'approval',
        params: { threadId: 'thread1', turnId: 'turn1', itemId: 'item1' },
      });
      expect(messages().find((entry) => entry.id === 'approval' && !entry.method).result).toEqual({
        decision: 'accept',
      });
    },
  );

  it('treats host approval cancellation as a cancelled generation, even if completion races', async () => {
    const { adapter, events, messages } = fixture('approval', { onApproval: () => 'cancel' });
    expect(await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).toMatchObject({
      success: false,
      data: { status: 'interrupted' },
      message: 'Codex approval cancelled',
    });
    expect(messages().find((entry) => entry.id === 'approval' && !entry.method).result).toEqual({
      decision: 'cancel',
    });
    expect(events.at(-1)?.type).toBe('generation-cancelled');
    expect(events.some((event) => event.type === 'generation-completed')).toBe(false);
  });

  it.each(['throw', 'timeout', 'invalid'])('declines a %s host review', async (mode) => {
    const { adapter, messages } = fixture('approval', {
      approvalTimeoutMs: 50,
      onApproval: () => {
        if (mode === 'throw') throw new Error('host unavailable');
        if (mode === 'timeout') return new Promise(() => {});
        return 'acceptForSession' as 'accept';
      },
    });
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      false,
    );
    expect(messages().find((entry) => entry.id === 'approval' && !entry.method).result).toEqual({
      decision: 'decline',
    });
  });

  it.each(['foreign-approval', 'grant-root'])(
    'declines %s without calling the host',
    async (mode) => {
      let called = false;
      const { adapter } = fixture(mode, {
        onApproval: () => {
          called = true;
          return 'accept';
        },
      });
      expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
        false,
      );
      expect(called).toBe(false);
    },
  );

  it('aborts a cancelled review and discards its late acceptance', async () => {
    let accept!: (value: 'accept') => void;
    let signal: AbortSignal | undefined;
    let opened!: () => void;
    const reviewing = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const { adapter, messages } = fixture('approval', {
      onApproval: (_request, currentSignal) => {
        signal = currentSignal;
        opened();
        return new Promise((resolve) => {
          accept = resolve;
        });
      },
    });
    const result = adapter.execute({ type: 'headless-prompt', prompt: 'hello' });
    await reviewing;
    const cancelled = adapter.execute({ type: 'cancel-generation' });
    accept('accept');
    expect((await cancelled).success).toBe(true);
    expect((await result).success).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(
      messages().some((entry) => entry.id === 'approval' && entry.result?.decision === 'accept'),
    ).toBe(false);
  });

  it('never answers a request already resolved by the server', async () => {
    const { adapter, messages } = fixture('resolved-approval', {
      onApproval: (_request, signal) =>
        new Promise((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              resolve('accept');
            },
            { once: true },
          );
        }),
    });
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      false,
    );
    expect(messages().some((entry) => entry.id === 'approval' && !entry.method)).toBe(false);
  });

  it('rejects invalid resume ids and ambiguous MCP entries before spawning', async () => {
    const { adapter, root } = fixture();
    expect(
      (await adapter.execute({ type: 'headless-prompt', prompt: 'hello', threadId: ' ' })).success,
    ).toBe(false);
    expect(existsSync(join(root, 'wire.jsonl'))).toBe(false);
    expect(
      () => new CodexAdapter({ mcpServers: [{ name: 'bad.name', command: 'server' }] }),
    ).toThrow();
    const server = studioLocalKnowledgeGraphMcpServer();
    expect(() => new CodexAdapter({ mcpServers: [server, server] })).toThrow();
  });

  it('accepts completion before the turn/start response without hanging', async () => {
    const { adapter } = fixture('early-complete');
    expect(await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).toMatchObject({
      success: true,
      message: 'Final π answer',
    });
  });

  it.each(['failed', 'interrupted', 'rpc-error', 'malformed', 'close', 'overflow'])(
    'fails closed for %s with no success event',
    async (mode) => {
      const { adapter, events } = fixture(mode);
      expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
        false,
      );
      expect(events.some((event) => event.type === 'generation-completed')).toBe(false);
      expect(events.at(-1)?.type).toBe('generation-failed');
    },
  );

  it.each(['approval', 'unknown-request'])('does not grant authority through %s', async (mode) => {
    const { adapter, messages } = fixture(mode);
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      false,
    );
    const response = messages().find(
      (entry) => entry.id === (mode === 'approval' ? 'approval' : 'unknown') && !entry.method,
    );
    if (mode === 'approval') expect(response.result).toEqual({ decision: 'decline' });
    else expect(response.error.code).toBe(-32601);
  });

  it.each(['hold', 'pending-start', 'ignore-interrupt'])(
    'cancels %s, waits for cleanup, and rejects concurrent/mismatched requests',
    async (mode) => {
      const { adapter, events, messages } = fixture(mode);
      const result = adapter.execute({ type: 'headless-prompt', prompt: 'wait' });
      await waitForEvent(adapter, events, 'generation-ready');
      expect((await adapter.execute({ type: 'headless-prompt', prompt: 'overlap' })).success).toBe(
        false,
      );
      expect((await adapter.execute({ type: 'cancel-generation', taskId: 'wrong' })).success).toBe(
        false,
      );
      const started = events[0];
      if (started.type !== 'generation-started') throw new Error('Missing start event');
      expect(
        (await adapter.execute({ type: 'cancel-generation', taskId: started.taskId })).success,
      ).toBe(true);
      expect(await result).toMatchObject({ success: false, data: { status: 'interrupted' } });
      expect(messages().find((entry) => entry.method === 'turn/interrupt').params).toEqual({
        threadId: 'thread1',
        turnId: 'turn1',
      });
      expect(events.at(-1)?.type).toBe('generation-cancelled');
      expect(() => process.kill(messages()[0].pid, 0)).toThrow();
    },
  );

  it('bounds initialization stalls and permits reuse after a failed generation', async () => {
    const { adapter, messages } = fixture('startup-hang');
    const result = await adapter.execute({
      type: 'headless-prompt',
      prompt: 'hello',
      timeoutMs: 150,
    });
    expect(result).toMatchObject({
      success: false,
      message: 'Codex generation timed out after 150ms',
    });
    expect(() => process.kill(messages()[0].pid, 0)).toThrow();
    expect(
      (await adapter.execute({ type: 'headless-prompt', prompt: 'again', timeoutMs: 150 })).message,
    ).toContain('timed out');
  });

  it('disposes during an active turn and never dispatches after disposal', async () => {
    const { adapter, events } = fixture('hold');
    const result = adapter.execute({ type: 'headless-prompt', prompt: 'wait' });
    await waitForEvent(adapter, events, 'generation-ready');
    await adapter.dispose();
    expect(await result).toMatchObject({ success: false, message: 'Codex adapter disposed' });
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'again' })).message).toContain(
      'disposed',
    );
  });

  it('cleans descendants after successful turns, including children retaining stdout pipes', async () => {
    const { adapter, messages } = fixture('descendant');
    expect((await adapter.execute({ type: 'generate-code', prompt: 'hello' })).success).toBe(true);
    const pid = messages().find((entry) => entry.descendant).descendant;
    await expect
      .poll(() => {
        try {
          return readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ')[2] === 'Z';
        } catch {
          return true;
        }
      })
      .toBe(true);
  });

  it('rejects unenforced limits and unsupported operations before launching', async () => {
    const { adapter } = fixture();
    expect(
      (await adapter.execute({ type: 'headless-prompt', prompt: 'hello', maxTurns: 1 })).success,
    ).toBe(false);
    expect(
      (await adapter.execute({ type: 'headless-prompt', prompt: 'hello', timeoutMs: 0 })).success,
    ).toBe(false);
    expect((await adapter.execute({ type: 'apply-edit', filePath: 'x', diff: 'x' })).success).toBe(
      false,
    );
    expect((await adapter.execute({ type: 'cancel-generation' })).success).toBe(false);
    expect(() => new CodexAdapter({ timeoutMs: Infinity })).toThrow();
  });

  it('blocks incomplete registered delivery before launching, then uses materialized policy at the configured root', async () => {
    const { adapter, root, messages } = fixture();
    const config = ManagerSchema.parse({
      contentRoot: 'control/shared',
      adapters: [{ id: 'codex' }],
    });
    writeManager(root, config);
    const blocked = await adapter.execute({ type: 'headless-prompt', prompt: 'hello' });
    expect(blocked.message).toContain('Codex project delivery is incomplete');
    expect(existsSync(join(root, 'wire.jsonl'))).toBe(false);
    materializeManager(root, { config, adapters: ['codex'] });
    writeManagerAdapterContent(root);
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      true,
    );
    expect(
      messages().find((message) => message.method === 'thread/start').params.developerInstructions,
    ).toContain('.revealui/control/shared/rules/durable-solutions.md');
  });

  it('cancels before spawn and isolates observer errors without leaking active state', async () => {
    const { adapter, root } = fixture();
    let cancellation: ReturnType<CodexAdapter['execute']> | undefined;
    adapter.onEvent((event) => {
      if (event.type === 'generation-started')
        cancellation = adapter.execute({ type: 'cancel-generation', taskId: event.taskId });
      throw new Error('observer failure');
    });
    expect((await adapter.execute({ type: 'headless-prompt', prompt: 'hello' })).success).toBe(
      false,
    );
    expect((await cancellation)?.success).toBe(true);
    expect(existsSync(join(root, 'wire.jsonl'))).toBe(false);
  });
});

describe('Codex managed memory commands', () => {
  it('advertises memory only when managed identity is configured', () => {
    expect(new CodexAdapter().getProtocolCapabilities().memory).toEqual({
      supported: false,
      backend: 'none',
    });
    expect(new CodexAdapter({ studioLocalMemory: {} }).getProtocolCapabilities().memory).toEqual({
      supported: true,
      backend: 'knowledge-graph',
    });
  });
  it('returns unavailable without launching a child when memory is unwired', async () => {
    const { adapter, trace } = fixture();
    expect(
      await adapter.execute({ type: 'query-memory', input: { query: 'finding' } }),
    ).toMatchObject({
      success: false,
      data: { status: 'unavailable', reason: 'durable-memory-unwired' },
    });
    expect(existsSync(trace)).toBe(false);
  });

  it('bounds a stalled identity registration by the dispatch budget', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'codex-registration-'));
    roots.push(dir);
    const socketPath = join(dir, 'daemon.sock');
    const server = createServer((socket) => socket.resume());
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    try {
      const { adapter, trace } = fixture('complete', {
        timeoutMs: 100,
        studioLocalMemory: {
          socketPath,
          timeoutMs: 60000,
          identityDir: join(dir, 'identities'),
          sessionDir: join(dir, 'sessions'),
          archiveDir: join(dir, 'archive'),
        },
      });
      const started = Date.now();
      expect(
        await adapter.execute({ type: 'query-memory', input: { query: 'finding' } }),
      ).toMatchObject({ success: false, data: { status: 'unavailable' } });
      expect(Date.now() - started).toBeLessThan(1000);
      expect(existsSync(trace)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects a competing managed MCP entry before registering identity', () => {
    expect(
      () =>
        new CodexAdapter({
          studioLocalMemory: {},
          mcpServers: [studioLocalKnowledgeGraphMcpServer()],
        }),
    ).toThrow('owns the knowledge-graph');
  });

  it.each(['complete', 'memory-hold'])(
    'routes memory without inference and cleans up %s',
    async (mode) => {
      const close = vi.fn(async () => ({ ok: true, skipped: false }));
      vi.spyOn(boundary, 'openRuntimeSession').mockResolvedValue({
        ok: true,
        skipped: false,
        identity: {
          agentId: 'codex-test',
          did: 'did:revealfleet:codex-test:fp',
          fingerprint: 'fp',
        },
        close,
      });
      const { adapter, trace } = fixture(mode, {
        studioLocalMemory: {},
        timeoutMs: mode === 'memory-hold' ? 500 : 5000,
      });
      const result = await adapter.execute({ type: 'query-memory', input: { query: 'finding' } });
      expect(result).toMatchObject({
        success: mode === 'complete',
        data: { status: mode === 'complete' ? 'ok' : 'unavailable' },
      });
      const requests = readFileSync(trace, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(requests.some((request) => request.method === 'mcpServer/tool/call')).toBe(true);
      expect(requests.some((request) => request.method === 'turn/start')).toBe(false);
      const started = requests.find((request) => request.method === 'thread/start');
      expect(started.params.config['mcp_servers.knowledge-graph'].env).toMatchObject({
        REVDEV_AGENT_ID: 'codex-test',
        REVDEV_HARNESS: 'codex',
      });
      await Promise.all([adapter.dispose(), adapter.dispose()]);
      expect(close).toHaveBeenCalledTimes(1);
    },
  );
});
