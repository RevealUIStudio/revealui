/**
 * MCP argument completions — POST /api/mcp/remote-servers/[server]/complete
 *
 * Proxies `completions/complete` to a remote MCP server for argument
 * autocompletion on a prompt or resource-template reference. Body:
 * ```
 * {
 *   tenant: string,
 *   ref: { type: 'ref/prompt', name: string }
 *      | { type: 'ref/resource', uri: string },
 *   argument: { name: string, value: string }
 * }
 * ```
 *
 * Feeds the admin's argument-completion-aware inputs per Stage 3.2. Note:
 * the MCP completions protocol is for prompts + resource templates, not for
 * tool arguments — tools surface their schema via `Tool.inputSchema`.
 */

import { getSession } from '@revealui/auth/server';
import { type Completion, McpCapabilityError } from '@revealui/mcp/client';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

type ParsedRef = { type: 'ref/prompt'; name: string } | { type: 'ref/resource'; uri: string };

function parseRef(input: unknown): ParsedRef | null {
  if (typeof input !== 'object' || input === null) return null;
  const ref = input as { type?: unknown; name?: unknown; uri?: unknown };
  if (ref.type === 'ref/prompt') {
    if (typeof ref.name !== 'string' || ref.name.length === 0) return null;
    return { type: 'ref/prompt', name: ref.name };
  }
  if (ref.type === 'ref/resource') {
    if (typeof ref.uri !== 'string' || ref.uri.length === 0) return null;
    return { type: 'ref/resource', uri: ref.uri };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<NextResponse<{ completion: Completion } | { error: string; detail?: string }>> {
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

  let body: { tenant?: unknown; ref?: unknown; argument?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const { tenant } = body;
  if (typeof tenant !== 'string' || !IDENTIFIER_RE.test(tenant)) {
    return NextResponse.json(
      { error: 'body.tenant must be a string matching /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }
  const ref = parseRef(body.ref);
  if (!ref) {
    return NextResponse.json(
      {
        error: "body.ref must be { type: 'ref/prompt', name } or { type: 'ref/resource', uri }",
      },
      { status: 400 },
    );
  }
  const argInput = body.argument;
  if (typeof argInput !== 'object' || argInput === null) {
    return NextResponse.json(
      { error: 'body.argument must be { name: string, value: string }' },
      { status: 400 },
    );
  }
  const argument = argInput as { name?: unknown; value?: unknown };
  if (
    typeof argument.name !== 'string' ||
    argument.name.length === 0 ||
    typeof argument.value !== 'string'
  ) {
    return NextResponse.json(
      { error: 'body.argument.name must be a non-empty string; body.argument.value a string' },
      { status: 400 },
    );
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
    const completion = await built.client.complete(ref, {
      name: argument.name,
      value: argument.value,
    });
    return NextResponse.json({ completion });
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
