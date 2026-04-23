/**
 * MCP get-prompt — POST /api/mcp/remote-servers/[server]/get-prompt
 *
 * Resolves a prompt on a connected remote MCP server with the given
 * string-valued arguments. Returns the full `GetPromptResult` — the
 * `messages` array is what a client LLM would consume.
 *
 * Body:
 * ```
 * { tenant: string, name: string, arguments?: Record<string, string> }
 * ```
 *
 * Per the MCP spec, prompt arguments are strings (not arbitrary JSON
 * values). This is enforced here — non-string values surface as HTTP 400.
 *
 * Stage 3.3 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { type GetPromptResult, McpCapabilityError } from '@revealui/mcp/client';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<NextResponse<{ result: GetPromptResult } | { error: string; detail?: string }>> {
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

  let args: Record<string, string> | undefined;
  if (body.arguments !== undefined) {
    if (
      typeof body.arguments !== 'object' ||
      body.arguments === null ||
      Array.isArray(body.arguments)
    ) {
      return NextResponse.json(
        { error: 'body.arguments must be a plain object of string values when provided' },
        { status: 400 },
      );
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.arguments as Record<string, unknown>)) {
      if (typeof v !== 'string') {
        return NextResponse.json(
          {
            error: `body.arguments.${k} must be a string (MCP prompt arguments are string-valued)`,
          },
          { status: 400 },
        );
      }
      out[k] = v;
    }
    args = out;
  }

  let built: Awaited<ReturnType<typeof buildRemoteMcpClient>>;
  try {
    built = await buildRemoteMcpClient({ tenant, server });
  } catch (err) {
    if (err instanceof RemoteServerNotConnectedError) {
      return NextResponse.json({ error: 'not_connected', detail: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'meta_load_failed', detail: (err as Error).message.slice(0, 200) },
      { status: 500 },
    );
  }

  try {
    await built.client.connect();
    const result = await built.client.getPrompt(name, args);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof McpCapabilityError) {
      return NextResponse.json(
        { error: 'capability_missing', detail: err.message },
        { status: 412 },
      );
    }
    return NextResponse.json(
      { error: 'mcp_call_failed', detail: (err as Error).message.slice(0, 200) },
      { status: 502 },
    );
  } finally {
    await built.client.close().catch(() => undefined); // empty-catch-ok: best-effort transport teardown
  }
}
