/**
 * MCP OAuth initiate — GET /api/mcp/oauth/initiate
 *
 * Kicks off the OAuth 2.1 authorization flow for a remote MCP server.
 * Runs SDK discovery + DCR + PKCE against the target server via
 * `McpOAuthProvider`, stores a pending-flow record in revvault keyed by the
 * authorization state, and 302-redirects the user to the authorization URL.
 *
 * Query params:
 *   tenant    — tenant identifier (first revvault path segment)
 *   server    — server identifier (second segment; e.g. `linear`, `notion`)
 *   serverUrl — the MCP server's base URL (e.g. `https://mcp.linear.app`)
 *
 * On return from the authorization server, the user lands at
 * `/api/mcp/oauth/callback` (see `../callback/route.ts`), which finalizes the
 * token exchange.
 *
 * Stage 2 PR-2.2 of the MCP v1 plan. See
 * `.jv/docs/mcp-productionization-scope.md`.
 */

import { randomUUID } from 'node:crypto';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { getSession } from '@revealui/auth/server';
import {
  createRevvaultVault,
  McpOAuthProvider,
  type OAuthClientMetadata,
} from '@revealui/mcp/oauth';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

const PENDING_PATH_PREFIX = 'mcp/oauth/pending';
const IDENTIFIER_RE = /^[A-Za-z0-9_-]{1,64}$/;

interface PendingRecord {
  tenant: string;
  server: string;
  serverUrl: string;
  userId: string;
  createdAt: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const params = requestUrl.searchParams;
  const tenant = params.get('tenant');
  const server = params.get('server');
  const serverUrlRaw = params.get('serverUrl');

  if (!(tenant && server && serverUrlRaw)) {
    return NextResponse.json(
      { error: 'tenant, server, and serverUrl query parameters are required' },
      { status: 400 },
    );
  }
  if (!(IDENTIFIER_RE.test(tenant) && IDENTIFIER_RE.test(server))) {
    return NextResponse.json(
      { error: 'tenant and server must match /^[A-Za-z0-9_-]{1,64}$/' },
      { status: 400 },
    );
  }

  let serverUrl: URL;
  try {
    serverUrl = new URL(serverUrlRaw);
  } catch {
    return NextResponse.json({ error: 'serverUrl is not a valid URL' }, { status: 400 });
  }
  if (
    serverUrl.protocol !== 'https:' &&
    serverUrl.hostname !== 'localhost' &&
    serverUrl.hostname !== '127.0.0.1'
  ) {
    return NextResponse.json(
      { error: 'serverUrl must use https: (localhost allowed for development)' },
      { status: 400 },
    );
  }

  const callbackUrl = new URL('/api/mcp/oauth/callback', requestUrl.origin).toString();
  const state = randomUUID();

  const vault = createRevvaultVault();

  const pending: PendingRecord = {
    tenant,
    server,
    serverUrl: serverUrl.toString(),
    userId: authSession.user.id,
    createdAt: new Date().toISOString(),
  };
  await vault.set(`${PENDING_PATH_PREFIX}/${state}`, JSON.stringify(pending));

  const clientMetadata: OAuthClientMetadata = {
    redirect_uris: [callbackUrl],
    client_name: 'RevealUI Admin',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  const provider = new McpOAuthProvider({
    tenant,
    server,
    vault,
    redirectUrl: callbackUrl,
    clientMetadata,
    state: () => state,
  });

  const result = await auth(provider, { serverUrl });

  if (result !== 'REDIRECT' || !provider.lastAuthorizationUrl) {
    await vault.delete(`${PENDING_PATH_PREFIX}/${state}`).catch(() => undefined);
    return NextResponse.json(
      {
        error: 'OAuth flow did not produce a redirect',
        detail: `auth() returned ${result}; lastAuthorizationUrl is ${
          provider.lastAuthorizationUrl ? 'set' : 'unset'
        }`,
      },
      { status: 502 },
    );
  }

  return NextResponse.redirect(provider.lastAuthorizationUrl.toString(), 302);
}
