/**
 * MCP resources list — GET /api/mcp/remote-servers/[server]/resources?tenant=X
 *
 * Connects to an OAuth-authorized remote MCP server and returns the list
 * of resources it advertises. Short-lived: the client is torn down after
 * the call. Requires the server to advertise the `resources` capability.
 *
 * Stage 3.3 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { McpCapabilityError, type Resource } from '@revealui/mcp/client';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<NextResponse<{ resources: Resource[] } | { error: string; detail?: string }>> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { server } = await context.params;
  const tenant = new URL(request.url).searchParams.get('tenant');

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
    const resources = await built.client.listResources();
    return NextResponse.json({ resources });
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
