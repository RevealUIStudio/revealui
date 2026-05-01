/**
 * MCP OAuth callback — GET /api/mcp/oauth/callback
 *
 * Finalizes an OAuth 2.1 flow started by `../initiate/route.ts`. The
 * authorization server redirects the user here with `?code=...&state=...` (or
 * `?error=...` on rejection). We resolve the pending record in revvault by
 * state, rebuild the `McpOAuthProvider` with the same (tenant, server) pair,
 * and run the token exchange via the SDK's `auth()` helper. Tokens land in
 * `mcp/<tenant>/<server>/tokens` via the provider's `saveTokens`.
 *
 * On success: 302 to `/mcp/connect?connected=<server>`.
 * On error:   302 to `/mcp/connect?error=<reason>&server=<server>`.
 *
 * Stage 2 PR-2.2 of the MCP v1 plan.
 */

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
const RESULT_PAGE = '/mcp/connect';
/** Reject pending records older than this — authorization code TTL is ~minutes per OAuth 2.1 §4.1.2. */
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

interface PendingRecord {
  tenant: string;
  server: string;
  serverUrl: string;
  userId: string;
  createdAt: string;
}

function resultUrl(origin: string, params: Record<string, string>): string {
  const url = new URL(RESULT_PAGE, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
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
  const origin = requestUrl.origin;
  const state = params.get('state');
  const code = params.get('code');
  const asError = params.get('error');

  if (!state) {
    return NextResponse.redirect(resultUrl(origin, { error: 'missing_state' }), 302);
  }

  const vault = createRevvaultVault();
  const pendingPath = `${PENDING_PATH_PREFIX}/${state}`;

  const raw = await vault.get(pendingPath);
  if (!raw) {
    return NextResponse.redirect(resultUrl(origin, { error: 'invalid_or_expired_state' }), 302);
  }

  // One-shot: always delete the pending record, whether this call succeeds or
  // fails. Prevents replay and keeps the store from filling with orphans.
  await vault.delete(pendingPath).catch(() => undefined);

  let pending: PendingRecord;
  try {
    pending = JSON.parse(raw) as PendingRecord;
  } catch {
    return NextResponse.redirect(resultUrl(origin, { error: 'corrupted_pending_record' }), 302);
  }

  if (pending.userId !== authSession.user.id) {
    return NextResponse.redirect(resultUrl(origin, { error: 'session_mismatch' }), 302);
  }

  const age = Date.now() - Date.parse(pending.createdAt);
  if (!Number.isFinite(age) || age > PENDING_MAX_AGE_MS) {
    return NextResponse.redirect(resultUrl(origin, { error: 'pending_expired' }), 302);
  }

  if (asError) {
    return NextResponse.redirect(
      resultUrl(origin, { error: asError, server: pending.server }),
      302,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      resultUrl(origin, { error: 'missing_code', server: pending.server }),
      302,
    );
  }

  const callbackUrl = new URL('/api/mcp/oauth/callback', origin).toString();
  const clientMetadata: OAuthClientMetadata = {
    redirect_uris: [callbackUrl],
    client_name: 'RevealUI Admin',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  const provider = new McpOAuthProvider({
    tenant: pending.tenant,
    server: pending.server,
    vault,
    redirectUrl: callbackUrl,
    clientMetadata,
    state: () => state,
  });

  try {
    const result = await auth(provider, {
      serverUrl: pending.serverUrl,
      authorizationCode: code,
    });
    if (result !== 'AUTHORIZED') {
      return NextResponse.redirect(
        resultUrl(origin, {
          error: 'token_exchange_incomplete',
          server: pending.server,
          detail: String(result),
        }),
        302,
      );
    }
  } catch (err) {
    return NextResponse.redirect(
      resultUrl(origin, {
        error: 'token_exchange_failed',
        server: pending.server,
        detail: (err as Error).message.slice(0, 200),
      }),
      302,
    );
  }

  // Persist non-credential metadata for downstream admin tooling (tool browser,
  // server catalog detail pages). Consumers read from this same path via
  // `lib/mcp/remote-server-client.ts`. If this write fails we still consider
  // the authorization successful — the user can reconnect to rehydrate meta.
  const meta = {
    serverUrl: pending.serverUrl,
    connectedAt: new Date().toISOString(),
    connectedBy: authSession.user.id,
  };
  await vault
    .set(`mcp/${pending.tenant}/${pending.server}/meta`, JSON.stringify(meta))
    .catch(() => undefined); // empty-catch-ok: meta is best-effort — tokens are the load-bearing state

  return NextResponse.redirect(resultUrl(origin, { connected: pending.server }), 302);
}
