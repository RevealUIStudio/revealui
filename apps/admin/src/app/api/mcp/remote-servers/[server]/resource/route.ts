/**
 * MCP resource read — GET /api/mcp/remote-servers/[server]/resource?tenant=X&uri=...
 *
 * Fetches the contents of a single resource from a connected remote MCP
 * server. Returns the SDK's `ResourceContents[]` shape verbatim — each
 * block is either `{ uri, mimeType?, text }` or `{ uri, mimeType?, blob }`
 * (base64). The admin preview pane renders text blocks in a monospace
 * viewer and surfaces mime-type chips for binary blobs.
 *
 * Stage 3.3 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { McpCapabilityError, type ResourceContents } from '@revealui/mcp/client';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildRemoteMcpClient,
  RemoteServerNotConnectedError,
} from '@/lib/mcp/remote-server-client';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_URI_LENGTH = 2048;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<NextResponse<{ contents: ResourceContents[] } | { error: string; detail?: string }>> {
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
  const uri = url.searchParams.get('uri');

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
  if (!uri || uri.length > MAX_URI_LENGTH) {
    return NextResponse.json(
      { error: `uri query parameter is required (≤${MAX_URI_LENGTH} chars)` },
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
    const contents = await built.client.readResource(uri);
    return NextResponse.json({ contents });
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
