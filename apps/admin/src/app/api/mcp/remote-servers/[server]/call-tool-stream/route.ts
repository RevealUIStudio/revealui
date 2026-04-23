/**
 * MCP streaming tool invoke — POST /api/mcp/remote-servers/[server]/call-tool-stream
 *
 * Streams progress notifications, log messages, elicitation requests, and
 * the final `CallToolResult` back to the browser as Server-Sent Events.
 * Companion routes:
 *   - `POST .../elicitation-respond` resolves a pending elicitation.
 *   - Aborting the fetch on the client side forwards an AbortSignal through
 *     the SDK transport, which emits `notifications/cancelled` on the wire.
 *
 * SSE event shapes (all emitted as `data: <json>\n\n`):
 *   { type: 'session',     sessionId: string }
 *   { type: 'log',         level, data, logger? }
 *   { type: 'progress',    progress: number, total?: number, message?: string }
 *   { type: 'elicitation', id: string, message: string, requestedSchema: object }
 *   { type: 'result',      result: CallToolResult }
 *   { type: 'error',       error: string, detail?: string }
 *
 * The stream always closes with exactly one of `result` or `error`.
 *
 * Stage 3.4 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { McpCapabilityError } from '@revealui/mcp/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  awaitElicitationResponse,
  createCallSession,
  deleteCallSession,
} from '@/lib/mcp/call-sessions';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

type SseEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'log'; level: string; data: unknown; logger?: string }
  | { type: 'progress'; progress: number; total?: number; message?: string }
  | { type: 'elicitation'; id: string; message: string; requestedSchema: unknown }
  | { type: 'result'; result: unknown }
  | { type: 'error'; error: string; detail?: string };

function encodeEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<Response> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { server } = await context.params;
  if (!IDENTIFIER_RE.test(server)) {
    return NextResponse.json(
      { error: 'server path segment must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }

  let body: { tenant?: unknown; name?: unknown; arguments?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  const { tenant, name } = body;
  if (typeof tenant !== 'string' || !IDENTIFIER_RE.test(tenant)) {
    return NextResponse.json(
      { error: 'body.tenant must be a string matching /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }
  if (typeof name !== 'string' || name.length === 0 || name.length > 256) {
    return NextResponse.json(
      { error: 'body.name must be a non-empty string (≤256 chars)' },
      { status: 400 },
    );
  }
  let args: Record<string, unknown> | undefined;
  if (body.arguments !== undefined) {
    if (
      typeof body.arguments !== 'object' ||
      body.arguments === null ||
      Array.isArray(body.arguments)
    ) {
      return NextResponse.json(
        { error: 'body.arguments must be a plain object when provided' },
        { status: 400 },
      );
    }
    args = body.arguments as Record<string, unknown>;
  }

  // Build the streaming response. The rest of the handler runs inside the
  // ReadableStream's start() so events are emitted as they happen.
  const session = createCallSession(authSession.user.id);
  const encoder = new TextEncoder();
  const abortCtrl = new AbortController();
  request.signal.addEventListener('abort', () => abortCtrl.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: SseEvent): void => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // empty-catch-ok: controller already closed — nothing to do
        }
      };

      write({ type: 'session', sessionId: session.sessionId });

      let built: Awaited<ReturnType<typeof buildRemoteMcpClient>> | undefined;
      let unsubscribeLog: (() => void) | undefined;
      try {
        built = await buildRemoteMcpClient({
          tenant: tenant as string,
          server,
          elicitationHandler: async (params) => {
            // URL-mode elicitation (out-of-band consent flows) isn't yet
            // supported by the inspector — decline so the server can fall
            // back. Form-mode with an inline `requestedSchema` is the
            // common case and renders natively below.
            if ((params as { mode?: string }).mode === 'url') {
              return { action: 'decline' };
            }
            const requestedSchema = (
              params as {
                requestedSchema?: unknown;
              }
            ).requestedSchema;
            const elicitationId = crypto.randomUUID();
            write({
              type: 'elicitation',
              id: elicitationId,
              message: params.message,
              requestedSchema,
            });
            return awaitElicitationResponse(session.sessionId, elicitationId);
          },
        });

        await built.client.connect();

        unsubscribeLog = built.client.onLog((logParams) => {
          write({
            type: 'log',
            level: logParams.level,
            data: logParams.data,
            ...(logParams.logger ? { logger: logParams.logger } : {}),
          });
        });

        const result = await built.client.callTool(name as string, args, {
          signal: abortCtrl.signal,
          onProgress: (p) => {
            write({
              type: 'progress',
              progress: p.progress,
              ...(p.total !== undefined ? { total: p.total } : {}),
              ...(p.message !== undefined ? { message: p.message } : {}),
            });
          },
        });

        write({ type: 'result', result });
      } catch (err) {
        if (abortCtrl.signal.aborted) {
          write({ type: 'error', error: 'cancelled' });
        } else if (err instanceof RemoteServerNotConnectedError) {
          write({ type: 'error', error: 'not_connected', detail: err.message });
        } else if (err instanceof McpCapabilityError) {
          write({ type: 'error', error: 'capability_missing', detail: err.message });
        } else {
          write({
            type: 'error',
            error: 'mcp_call_failed',
            detail: (err as Error).message.slice(0, 200),
          });
        }
      } finally {
        unsubscribeLog?.();
        if (built) {
          await built.client.close().catch(() => undefined); // empty-catch-ok: best-effort teardown
        }
        deleteCallSession(session.sessionId);
        try {
          controller.close();
        } catch {
          // empty-catch-ok: already closed (e.g. client disconnected)
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
