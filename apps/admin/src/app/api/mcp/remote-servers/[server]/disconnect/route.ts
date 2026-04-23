/**
 * MCP server disconnect — POST /api/mcp/remote-servers/[server]/disconnect
 *
 * Revokes the OAuth credentials stored for `(tenant, server)` by delegating
 * to `McpOAuthProvider.invalidateCredentials('all')`. Removes tokens, client
 * registration, PKCE verifier, and cached discovery state. Idempotent —
 * calling on an already-disconnected server is a no-op.
 *
 * Body: `{ "tenant": "<tenant-id>" }`
 *
 * Stage 3.1 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import {
  createRevvaultVault,
  McpOAuthProvider,
  type OAuthClientMetadata,
} from '@revealui/mcp/oauth';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Placeholder metadata — only needed to satisfy the provider constructor;
// `invalidateCredentials` does not depend on it.
const SENTINEL_CLIENT_METADATA: OAuthClientMetadata = {
  redirect_uris: ['http://localhost/unused'],
  client_name: 'RevealUI Admin (disconnect)',
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ server: string }> },
): Promise<NextResponse<{ disconnected: true } | { error: string }>> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { server } = await context.params;
  if (!(server && IDENTIFIER_RE.test(server))) {
    return NextResponse.json(
      { error: 'server path segment must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }

  let body: { tenant?: unknown };
  try {
    body = (await request.json()) as { tenant?: unknown };
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }
  const tenant = body.tenant;
  if (typeof tenant !== 'string' || !IDENTIFIER_RE.test(tenant)) {
    return NextResponse.json(
      { error: 'tenant must be a string matching /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }

  const vault = createRevvaultVault();
  const provider = new McpOAuthProvider({
    tenant,
    server,
    vault,
    redirectUrl: 'http://localhost/unused',
    clientMetadata: SENTINEL_CLIENT_METADATA,
  });

  await provider.invalidateCredentials('all');

  return NextResponse.json({ disconnected: true });
}
