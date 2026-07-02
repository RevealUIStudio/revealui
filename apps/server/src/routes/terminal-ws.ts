/**
 * Terminal WebSocket Bridge  -  Layer 3 of the Native Terminal Architecture.
 *
 * REST endpoints for session management + WebSocket for bidirectional PTY streaming.
 * Proxies between browser/remote clients and the harness daemon's PTY sessions.
 *
 * Routes:
 *   GET  /api/terminal/sessions        -  list active PTY sessions
 *   POST /api/terminal/sessions        -  spawn a new Claude Code session
 *   DELETE /api/terminal/sessions/:id  -  stop a session
 *   WS   /api/terminal/ws/:id          -  bidirectional terminal stream
 *
 * Auth: session cookie required (same as other API routes).
 * The daemon runs locally  -  WebSocket bridge gives remote access.
 */

import { createConnection } from 'node:net';
import { resolve, sep } from 'node:path';
import type { ServerType } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { z } from 'zod';

const DAEMON_SOCKET = `${process.env.HOME ?? '/tmp'}/.local/share/revealui/harness.sock`;

/**
 * Runtime validation for the spawn body. The previous `c.req.json<{...}>()`
 * was a TypeScript cast only — nothing constrained the values at runtime on a
 * PTY-spawning (code-execution-adjacent) endpoint.
 */
const SpawnTerminalSessionSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  cols: z.number().int().min(1).max(1024).optional(),
  rows: z.number().int().min(1).max(1024).optional(),
  cwd: z.string().min(1).max(4096).optional(),
});

/**
 * Bound the requested PTY working directory to the terminal workspace root
 * (REVEALUI_TERMINAL_WORKSPACE_ROOT, default $HOME — the daemon's own default).
 *
 * - omitted cwd → the root itself (matches the daemon's HOME fallback);
 * - relative cwd → resolved under the root;
 * - absolute cwd → admitted only when lexically inside the root;
 * - anything escaping the root (traversal or foreign absolute path) → null.
 *
 * Lexical bound only (no realpath) — the daemon additionally stat()s the
 * directory before spawning. Exported for direct unit testing.
 */
export function resolveWorkspaceCwd(requested: string | undefined): string | null {
  const root = resolve(process.env.REVEALUI_TERMINAL_WORKSPACE_ROOT ?? process.env.HOME ?? '/tmp');
  if (!requested) {
    return root;
  }
  const target = resolve(root, requested);
  if (target === root || target.startsWith(root + sep)) {
    return target;
  }
  return null;
}

/** JSON-RPC call to the harness daemon over Unix socket. */
function daemonRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(DAEMON_SOCKET);
    let buffer = '';
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Daemon RPC timeout'));
    }, 10_000);

    socket.on('connect', () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      socket.write(`${req}\n`);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx !== -1) {
        clearTimeout(timeout);
        const line = buffer.slice(0, newlineIdx);
        socket.destroy();
        try {
          const resp = JSON.parse(line) as { result?: unknown; error?: { message: string } };
          if (resp.error) {
            reject(new Error(resp.error.message));
          } else {
            resolve(resp.result);
          }
        } catch {
          reject(new Error('Invalid daemon response'));
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Daemon unreachable: ${err.message}`));
    });
  });
}

/** Create the terminal WebSocket route with its own Hono + WS adapter. */
export function createTerminalRoute(): {
  app: Hono;
  injectWebSocket: (server: ServerType) => void;
} {
  const app = new Hono();
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

  // ── REST: list sessions ────────────────────────────────────────────
  app.get('/sessions', async (c) => {
    try {
      const sessions = await daemonRpc('agent.list', {});
      return c.json(sessions);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Daemon unreachable' }, 503);
    }
  });

  // ── REST: spawn session ────────────────────────────────────────────
  app.post('/sessions', zValidator('json', SpawnTerminalSessionSchema), async (c) => {
    const body = c.req.valid('json');

    // Reject any cwd escaping the workspace root BEFORE the daemon RPC — the
    // daemon only stat()s the directory; it does not bound the path itself.
    const cwd = resolveWorkspaceCwd(body.cwd);
    if (cwd === null) {
      return c.json({ error: 'cwd is outside the terminal workspace root' }, 400);
    }

    const name = body.name ?? `remote-${Date.now().toString(36)}`;
    try {
      const result = await daemonRpc('agent.spawn', {
        name,
        backend: 'ClaudeCode',
        model: 'claude-opus-4-6',
        prompt: '',
        cwd,
        cols: body.cols ?? 120,
        rows: body.rows ?? 30,
      });
      return c.json(result, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Spawn failed' }, 500);
    }
  });

  // ── REST: stop session ─────────────────────────────────────────────
  app.delete('/sessions/:id', async (c) => {
    const sessionId = c.req.param('id');
    try {
      await daemonRpc('agent.stop', { sessionId });
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Stop failed' }, 500);
    }
  });

  // ── WebSocket: bidirectional PTY stream ────────────────────────────
  //
  // Client → Server messages:
  //   { type: 'input', data: '...' }        -  keystrokes to PTY
  //   { type: 'resize', cols: N, rows: N }  -  resize terminal
  //
  // Server → Client messages:
  //   { type: 'output', data: '...' }       -  PTY output
  //   { type: 'exit', code: N }             -  session ended
  //   { type: 'error', message: '...' }     -  error
  //
  app.get(
    '/ws/:id',
    upgradeWebSocket((c) => {
      const sessionId = c.req.param('id');

      // NOTE: output streaming is not yet implemented on this remote bridge.
      // Desktop clients receive agent output via the Tauri event system; the
      // remote WebSocket path needs the daemon to expose an output stream
      // (SSE / JSON-RPC subscription), which it does not have yet. Until then
      // this bridge forwards INPUT (keystrokes + resize) and leaves session
      // lifecycle to the REST endpoints. A previous 100ms output-poll timer
      // here did no work and burned CPU per open connection, so it was removed.
      // Real output streaming is tracked in revealui#1650.

      return {
        onMessage(event, ws) {
          try {
            const msg = JSON.parse(
              typeof event.data === 'string' ? event.data : event.data.toString(),
            ) as { type: string; data?: string; cols?: number; rows?: number };

            switch (msg.type) {
              case 'input': {
                if (msg.data !== undefined) {
                  daemonRpc('agent.input', { sessionId, data: msg.data }).catch((err) => {
                    ws.send(
                      JSON.stringify({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Input failed',
                      }),
                    );
                  });
                }
                break;
              }
              case 'resize': {
                if (msg.cols && msg.rows) {
                  daemonRpc('agent.resize', {
                    sessionId,
                    cols: msg.cols,
                    rows: msg.rows,
                  }).catch(() => {
                    // Resize failures are non-fatal
                  });
                }
                break;
              }
            }
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
          }
        },
      };
    }),
  );

  return { app, injectWebSocket };
}
