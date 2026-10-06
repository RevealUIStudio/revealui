/**
 * Tests for the terminal WebSocket bridge REST surface.
 *
 * Covers the PTY-spawn ingress hardening:
 * - runtime (Zod) validation of the spawn body — previously a TS cast only;
 * - cwd bounded to the terminal workspace root BEFORE any daemon RPC;
 * - operator role gate composition on the mount (owner/admin only).
 *
 * The daemon socket is mocked to be unreachable: a request that passes
 * validation must fail with the daemon error (proving it got past the guard)
 * without ever spawning a real PTY — the dev machine may have a live daemon.
 */

import { EventEmitter } from 'node:events';
import { createConnection } from 'node:net';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTerminalSpawn } from '../../../../../packages/harnesses/src/session/terminal-spawn.js';

vi.mock('node:net', () => ({
  createConnection: vi.fn(() => {
    const socket = new EventEmitter() as EventEmitter & {
      destroy: () => void;
      write: (data: string) => boolean;
    };
    socket.destroy = vi.fn();
    socket.write = vi.fn(() => true);
    queueMicrotask(() => {
      socket.emit('connect');
      socket.emit('error', new Error('ECONNREFUSED (test stub)'));
    });
    return socket;
  }),
}));

import { requireRole } from '../../middleware/auth.js';
import {
  createTerminalRoute,
  PTY_OUTPUT_NOT_IMPLEMENTED,
  ptyOutputHonestyNotice,
  resolveWorkspaceCwd,
} from '../terminal-ws.js';

const SPAWN_ENV_KEYS = [
  'TERMINAL_AGENT_BACKEND',
  'TERMINAL_AGENT_MODEL',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'INFERENCE_SNAPS_BASE_URL',
  'GROQ_API_KEY',
  'OLLAMA_BASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
] as const;

const savedSpawnEnv = new Map<string, string | undefined>();

const ROOT = '/srv/terminal-workspace';

beforeEach(() => {
  process.env.REVEALUI_TERMINAL_WORKSPACE_ROOT = ROOT;
  for (const key of SPAWN_ENV_KEYS) {
    savedSpawnEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  vi.mocked(createConnection).mockClear();
});

afterEach(() => {
  delete process.env.REVEALUI_TERMINAL_WORKSPACE_ROOT;
  for (const key of SPAWN_ENV_KEYS) {
    const saved = savedSpawnEnv.get(key);
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
});

function createApp() {
  return createTerminalRoute({ resolveSpawn: resolveTerminalSpawn }).app;
}

function lastSpawnParams(): Record<string, unknown> {
  const socket = vi.mocked(createConnection).mock.results.at(-1)?.value as {
    write: { mock: { calls: Array<[string]> } };
  };
  const raw = socket.write.mock.calls[0]?.[0];
  const frame = JSON.parse(String(raw)) as { params: Record<string, unknown> };
  return frame.params;
}

// ---------------------------------------------------------------------------
// resolveWorkspaceCwd
// ---------------------------------------------------------------------------
describe('PTY output honesty notice', () => {
  it('does not claim remote PTY output is live', () => {
    const notice = ptyOutputHonestyNotice();
    expect(notice.type).toBe('status');
    expect(notice.code).toBe('pty-output-preview');
    expect(notice.message).toBe(PTY_OUTPUT_NOT_IMPLEMENTED);
    expect(notice.message).toMatch(/not implemented/i);
  });
});

describe('resolveWorkspaceCwd', () => {
  it('defaults to the workspace root when no cwd is requested', () => {
    expect(resolveWorkspaceCwd(undefined)).toBe(ROOT);
  });

  it('resolves a relative cwd under the root', () => {
    expect(resolveWorkspaceCwd('projects/app')).toBe(`${ROOT}/projects/app`);
  });

  it('accepts the root itself and absolute paths inside it', () => {
    expect(resolveWorkspaceCwd(ROOT)).toBe(ROOT);
    expect(resolveWorkspaceCwd(`${ROOT}/nested`)).toBe(`${ROOT}/nested`);
  });

  it('rejects traversal escaping the root', () => {
    expect(resolveWorkspaceCwd('../../etc')).toBeNull();
    expect(resolveWorkspaceCwd('projects/../../../etc')).toBeNull();
  });

  it('rejects absolute paths outside the root', () => {
    expect(resolveWorkspaceCwd('/etc')).toBeNull();
    expect(resolveWorkspaceCwd('/')).toBeNull();
  });

  it('rejects sibling directories sharing the root as a string prefix', () => {
    // startsWith(root) without the separator would wrongly admit this.
    expect(resolveWorkspaceCwd(`${ROOT}-evil`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /sessions — validation before daemon RPC
// ---------------------------------------------------------------------------
describe('POST /sessions', () => {
  it('rejects a cwd outside the workspace root with 400, before any daemon call', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: '/etc' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('workspace root');
  });

  it('rejects traversal cwd with 400', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: '../../outside' }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects malformed body values (schema, not cast)', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cols: 'wide', rows: -5, cwd: 42 }),
    });

    expect(res.status).toBe(400);
  });

  it('forwards a valid in-root cwd to the daemon (fails only at the socket here)', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: 'projects/app', cols: 100, rows: 40 }),
    });

    // Past validation; the stubbed daemon socket refuses the connection.
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Daemon unreachable');
    const params = lastSpawnParams();
    expect(params.backend).toBe('InferenceSnaps');
    expect(params.model).toBe('gemma3');
    expect(params.cwd).toBe(`${ROOT}/projects/app`);
  });

  it('selects the spawn backend from config', async () => {
    process.env.TERMINAL_AGENT_BACKEND = 'Groq';
    process.env.TERMINAL_AGENT_MODEL = 'openai/gpt-oss-20b';
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
    const params = lastSpawnParams();
    expect(params.backend).toBe('Groq');
    expect(params.model).toBe('openai/gpt-oss-20b');
  });

  it('rejects a missing backend before any daemon call', async () => {
    process.env.TERMINAL_AGENT_BACKEND = '   ';
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe('missing-backend');
    expect(vi.mocked(createConnection)).not.toHaveBeenCalled();
  });

  it('rejects an unknown backend before any daemon call', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ backend: 'NotAVendor' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe('unknown-backend');
    expect(vi.mocked(createConnection)).not.toHaveBeenCalled();
  });

  it('rejects an excluded-origin model on the default backend', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openrouter/free' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('model-not-allowlisted');
    expect(vi.mocked(createConnection)).not.toHaveBeenCalled();
  });

  it('spawns ClaudeCode when that backend is explicitly selected', async () => {
    const app = createApp();
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ backend: 'ClaudeCode', model: 'claude-sonnet-4-6' }),
    });

    expect(res.status).toBe(500);
    const params = lastSpawnParams();
    expect(params.backend).toBe('ClaudeCode');
    expect(params.model).toBe('claude-sonnet-4-6');
  });
});

// ---------------------------------------------------------------------------
// Mount composition — operator role gate
// ---------------------------------------------------------------------------
describe('terminal mount role gate', () => {
  function createGatedApp(user: { id: string; role: string } | undefined) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (user) c.set('user', user);
      await next();
    });
    app.use('*', requireRole('owner', 'admin'));
    app.route('/', createTerminalRoute().app);
    return app;
  }

  it('403s an authenticated non-operator before any terminal route runs', async () => {
    const app = createGatedApp({ id: 'user-1', role: 'viewer' });
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
  });

  it('401s when no user is present', async () => {
    const app = createGatedApp(undefined);
    const res = await app.request('/sessions', { method: 'GET' });

    expect(res.status).toBe(401);
  });

  it('admits an admin through to the route handlers', async () => {
    const app = createGatedApp({ id: 'admin-1', role: 'admin' });
    const res = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: '/etc' }),
    });

    // Through the gate; rejected by the cwd bound (not by the role gate).
    expect(res.status).toBe(400);
  });
});
