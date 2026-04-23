/**
 * MCP log stream — GET /api/mcp/remote-servers/[server]/log-stream?tenant=X&level=info
 *
 * Opens a long-lived SSE connection to a remote MCP server, registers a
 * log listener, and streams `notifications/message` events back to the
 * browser as they arrive. Closing the HTTP connection (or aborting the
 * fetch on the client side) closes the MCP connection and stops streaming.
 *
 * SSE event shape: `data: { type: 'log', level, data, logger? }\n\n`.
 * An initial `{ type: 'ready' }` signals the connection is live.
 *
 * Supported `level` values: debug, info, notice, warning, error, critical,
 * alert, emergency. Defaults to `info`.
 *
 * Stage 3.4 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { type LoggingLevel, McpCapabilityError } from '@revealui/mcp/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ALLOWED_LEVELS: LoggingLevel[] = [
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
];

function parseLevel(value: string | null): LoggingLevel {
  if (value && (ALLOWED_LEVELS as string[]).includes(value)) return value as LoggingLevel;
  return 'info';
}

export async function GET(
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
  const url = new URL(request.url);
  const tenant = url.searchParams.get('tenant');
  const level = parseLevel(url.searchParams.get('level'));

  if (!(tenant && IDENTIFIER_RE.test(tenant))) {
    return NextResponse.json(
      { error: 'tenant query parameter must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }
  if (!IDENTIFIER_RE.test(server)) {
    return NextResponse.json(
      { error: 'server path segment must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const write = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: Record<string, unknown>,
  ): void => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // empty-catch-ok: controller already closed — nothing to do
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let built: Awaited<ReturnType<typeof buildRemoteMcpClient>> | undefined;
      let unsubscribe: (() => void) | undefined;

      const abort = () => {
        unsubscribe?.();
        if (built) {
          void built.client.close().catch(() => undefined); // empty-catch-ok: best-effort teardown
        }
        try {
          controller.close();
        } catch {
          // empty-catch-ok: already closed
        }
      };
      request.signal.addEventListener('abort', abort, { once: true });

      try {
        built = await buildRemoteMcpClient({ tenant, server });
        await built.client.connect();

        unsubscribe = built.client.onLog((logParams) => {
          write(controller, {
            type: 'log',
            level: logParams.level,
            data: logParams.data,
            ...(logParams.logger ? { logger: logParams.logger } : {}),
          });
        });

        await built.client.setLoggingLevel(level);
        write(controller, { type: 'ready', level });

        // Hold the stream open. The registered `abort` listener + the client
        // disconnecting tear it down. We intentionally never resolve this
        // Promise under normal operation.
        await new Promise<void>((resolve) => {
          request.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      } catch (err) {
        if (err instanceof RemoteServerNotConnectedError) {
          write(controller, { type: 'error', error: 'not_connected', detail: err.message });
        } else if (err instanceof McpCapabilityError) {
          write(controller, {
            type: 'error',
            error: 'capability_missing',
            detail: err.message,
          });
        } else if (!request.signal.aborted) {
          write(controller, {
            type: 'error',
            error: 'mcp_call_failed',
            detail: (err as Error).message.slice(0, 200),
          });
        }
      } finally {
        abort();
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
