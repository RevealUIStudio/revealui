/**
 * Streamable HTTP server helper for `@revealui/mcp` (Stage 1 PR-1.1).
 *
 * Wraps `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` with
 * session routing: one `MCP Server` + transport pair per concurrent client,
 * identified by the `Mcp-Session-Id` header. Initialize requests without a
 * session header allocate a new server via `createServer()`; subsequent
 * requests route to the matching session.
 *
 * Returns a Node `(req, res) => Promise<void>` handler suitable for use with
 * `http.createServer`, Express, Fastify, or any framework that exposes the
 * raw Node request/response pair. A Web-Standard (Request → Response)
 * variant can layer on top later — the session-routing logic is independent
 * of the concrete transport flavour.
 *
 * The SDK's `StreamableHTTPServerTransport` is a one-session-per-instance
 * primitive (see the `this.sessionId` field in its implementation). That's
 * why we maintain an external `Map<sessionId, { server, transport }>` and
 * not rely on a single transport to multiplex.
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Public options + types
// ---------------------------------------------------------------------------

export type StreamableHttpHandlerOptions = {
  /**
   * Called once per new session — returns a fresh `Server` instance to
   * connect to the session's transport. Keep this function pure; do not
   * share Server instances across sessions.
   */
  createServer: () => Server | Promise<Server>;

  /** Generate session IDs. Default: `crypto.randomUUID()`. */
  sessionIdGenerator?: () => string;

  /** Called when a new session is initialized. */
  onSessionInitialized?: (sessionId: string) => void | Promise<void>;

  /** Called when a session is terminated (DELETE or transport close). */
  onSessionClosed?: (sessionId: string) => void | Promise<void>;

  /**
   * Allowed `Origin` headers for DNS rebinding protection. If set, requests
   * with other origins are rejected. Mirrors the SDK's option.
   */
  allowedOrigins?: string[];

  /**
   * Allowed `Host` headers for DNS rebinding protection. If set, requests
   * with other hosts are rejected.
   */
  allowedHosts?: string[];

  /**
   * If true, responses are raw JSON instead of SSE streams. Useful for
   * deployments that can't hold open long-lived connections (many
   * serverless request/response platforms). Default: false.
   */
  enableJsonResponse?: boolean;
};

export type StreamableHttpHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

type SessionEntry = {
  server: Server;
  transport: StreamableHTTPServerTransport;
};

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Build a Node HTTP request handler that routes MCP Streamable HTTP traffic
 * to per-session `Server` + `Transport` pairs, allocating new sessions on
 * InitializeRequest and reusing them on follow-up requests via the
 * `Mcp-Session-Id` header.
 *
 * ```ts
 * import { createServer as createHttpServer } from 'node:http';
 * import { createNodeStreamableHttpHandler } from '@revealui/mcp/streamable-http';
 *
 * const mcpHandler = createNodeStreamableHttpHandler({
 *   createServer: () => makeMyMcpServer(),
 * });
 *
 * createHttpServer(mcpHandler).listen(3000);
 * ```
 */
export function createNodeStreamableHttpHandler(
  options: StreamableHttpHandlerOptions,
): StreamableHttpHandler {
  const sessions = new Map<string, SessionEntry>();
  const generateSessionId = options.sessionIdGenerator ?? (() => randomUUID());

  return async function mcpStreamableHttpHandler(req, res) {
    const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
    const rawSession = req.headers['mcp-session-id'];
    const sessionId = typeof rawSession === 'string' ? rawSession : undefined;

    // Existing session — delegate to its transport.
    if (sessionId) {
      const entry = sessions.get(sessionId);
      if (entry) {
        await entry.transport.handleRequest(req, res, body);
        return;
      }
      // Known-bad session header — let the transport produce the 404.
      // Fall through to fresh-session handling, which will reject
      // non-init requests.
    }

    // No session header: only an Initialize request may start a new session.
    if (!sessionId && req.method === 'POST' && isInitializeRequest(body)) {
      await handleNewSession(body);
      return;
    }

    sendJsonError(res, 400, sessionId ? 'Unknown session ID' : 'Session ID required');
    return;

    async function handleNewSession(parsedBody: unknown): Promise<void> {
      const server = await options.createServer();

      const transportOptions: StreamableHTTPServerTransportOptions = {
        sessionIdGenerator: generateSessionId,
        enableJsonResponse: options.enableJsonResponse,
        allowedHosts: options.allowedHosts,
        allowedOrigins: options.allowedOrigins,
        onsessioninitialized: async (id: string) => {
          sessions.set(id, { server, transport });
          await options.onSessionInitialized?.(id);
        },
        onsessionclosed: async (id: string) => {
          sessions.delete(id);
          await options.onSessionClosed?.(id);
        },
      };
      const transport = new StreamableHTTPServerTransport(transportOptions);

      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function sendJsonError(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message },
      id: null,
    }),
  );
}
