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
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:net', () => ({
  createConnection: vi.fn(() => {
    const socket = new EventEmitter() as EventEmitter & { destroy: () => void };
    socket.destroy = vi.fn();
    queueMicrotask(() => socket.emit('error', new Error('ECONNREFUSED (test stub)')));
    return socket;
  }),
}));

import { requireRole } from '../../middleware/auth.js';
import { createTerminalRoute, resolveWorkspaceCwd } from '../terminal-ws.js';

const ROOT = '/srv/terminal-workspace';

beforeEach(() => {
  process.env.REVEALUI_TERMINAL_WORKSPACE_ROOT = ROOT;
});

afterEach(() => {
  delete process.env.REVEALUI_TERMINAL_WORKSPACE_ROOT;
});

// ---------------------------------------------------------------------------
// resolveWorkspaceCwd
// ---------------------------------------------------------------------------
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
  function createApp() {
    return createTerminalRoute().app;
  }

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
