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
import type { ServerType } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';

const DAEMON_SOCKET = `${process.env.HOME ?? '/tmp'}/.local/share/revealui/harness.sock`;

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
  app.post('/sessions', async (c) => {
    const body = await c.req.json<{
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
    }>();

    const name = body.name ?? `remote-${Date.now().toString(36)}`;
    try {
      const result = await daemonRpc('agent.spawn', {
        name,
        backend: 'ClaudeCode',
        model: 'claude-opus-4-6',
        prompt: '',
        cwd: body.cwd ?? null,
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

      // Poll daemon for output via a persistent socket connection
      let outputSocket: ReturnType<typeof createConnection> | null = null;
      let closed = false;

      return {
        onOpen(_event, _ws) {
          // Subscribe to agent output by polling daemon
          // The daemon emits 'output' events  -  we poll via a long-lived connection
          // For now, use periodic RPC polling until daemon supports event streaming
          const pollInterval = setInterval(async () => {
            if (closed) {
              clearInterval(pollInterval);
              return;
            }
            // Output streaming is handled by the Tauri event system for desktop.
            // For remote WebSocket, the daemon's HTTP gateway SSE endpoint
            // would be the proper source. For now, the WebSocket bridge
            // forwards input and handles session lifecycle.
          }, 100);

          // Clean up on close
          outputSocket = null; // placeholder for future event stream
        },

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

        onClose() {
          closed = true;
          if (outputSocket) {
            outputSocket.destroy();
            outputSocket = null;
          }
        },
      };
    }),
  );

  return { app, injectWebSocket };
}
