/**
 * MCP remote servers — GET /api/mcp/remote-servers?tenant=X
 *
 * Lists the OAuth-authorized remote MCP servers for a given tenant.
 * Enumerates `mcp/<tenant>/<server>/tokens` in the backing vault and returns
 * the corresponding `{ tenant, server }` pairs. Connected tokens count as
 * connected; missing tokens count as disconnected (and simply aren't listed
 * here — the catalog UI surfaces the "connect" CTA separately).
 *
 * Stage 3.1 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import { createRevvaultVault } from '@revealui/mcp/oauth';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Revvault paths that live directly under `mcp/` but are NOT
 * tenants — reserved for the package's own bookkeeping. Keep in sync
 * with the path layout documented in `@revealui/mcp/oauth`.
 */
const RESERVED_TENANT_SEGMENTS = new Set(['oauth']);

export interface RemoteMcpServerSummary {
  tenant: string;
  server: string;
  connectionState: 'connected';
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<{ servers: RemoteMcpServerSummary[] } | { error: string }>> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const tenant = requestUrl.searchParams.get('tenant');
  if (!tenant) {
    return NextResponse.json({ error: 'tenant query parameter is required' }, { status: 400 });
  }
  if (!IDENTIFIER_RE.test(tenant)) {
    return NextResponse.json(
      { error: 'tenant must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }
  if (RESERVED_TENANT_SEGMENTS.has(tenant)) {
    return NextResponse.json({ error: `'${tenant}' is reserved` }, { status: 400 });
  }

  const vault = createRevvaultVault();
  const paths = await vault.list(`mcp/${tenant}/`);

  // Match `mcp/<tenant>/<server>/tokens` and collect unique server ids.
  const serverIds = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    if (segments.length === 4 && segments[3] === 'tokens') {
      const server = segments[2];
      if (server && IDENTIFIER_RE.test(server)) serverIds.add(server);
    }
  }

  const servers: RemoteMcpServerSummary[] = Array.from(serverIds)
    .sort()
    .map((server) => ({ tenant, server, connectionState: 'connected' }));

  return NextResponse.json({ servers });
}
