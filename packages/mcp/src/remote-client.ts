/**
 * Remote MCP server client helpers — tenant-scoped discovery + connection.
 *
 * Two responsibilities:
 *
 *   1. {@link listConnectedMcpServers} — enumerate the servers a tenant has
 *      an authorized OAuth token for in the vault. Does NOT connect; a pure
 *      metadata lookup.
 *
 *   2. {@link buildRemoteMcpClient} — load the stored server URL + OAuth
 *      meta for `(tenant, server)` and return a configured {@link McpClient}.
 *      The client is configured but NOT yet connected — callers invoke
 *      `connect()` themselves so they can manage teardown.
 *
 * Both helpers were originally defined alongside each other in the admin
 * app: {@link listConnectedMcpServers} as inline logic in the
 * `/api/mcp/remote-servers` route, {@link buildRemoteMcpClient} as the
 * admin-local `lib/mcp/remote-server-client.ts`. They moved here so the API
 * app can use the same path enumeration + client-construction logic without
 * duplicating admin code.
 */

import { type ElicitationHandler, McpClient } from './client.js';
import {
  createRevvaultVault,
  McpOAuthProvider,
  type OAuthClientMetadata,
  RevvaultError,
  type Vault,
} from './oauth.js';

/**
 * Safe identifier regex for tenant + server IDs. Matches the regex used by
 * the admin remote-servers route for incoming user input.
 */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// Tenant → connected-server discovery
// ---------------------------------------------------------------------------

/**
 * List the MCP servers that tenant `tenantId` has authorized OAuth tokens
 * for in the vault. Enumerates `mcp/<tenantId>/<server>/tokens` entries
 * and returns the unique server IDs, sorted ascending.
 *
 * A server appears here if and only if a successful OAuth flow has landed
 * a `tokens` blob at that path. Tokens may be expired — refresh/rotation
 * is the transport's concern via the `OAuthClientProvider` hooks. Callers
 * should treat this list as "has been authorized at least once" rather
 * than "is definitely healthy right now".
 *
 * @throws {RevvaultError} when the vault `list` call fails or when
 *   `tenantId` contains characters that would be unsafe to pass to the
 *   vault.
 */
export async function listConnectedMcpServers(vault: Vault, tenantId: string): Promise<string[]> {
  if (!SAFE_ID_RE.test(tenantId)) {
    throw new RevvaultError(`tenantId must match /^[A-Za-z0-9_-]{1,64}$/ (got: ${tenantId})`);
  }
  const paths = await vault.list(`mcp/${tenantId}/`);
  const serverIds = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    if (segments.length === 4 && segments[3] === 'tokens') {
      const server = segments[2];
      if (server && SAFE_ID_RE.test(server)) serverIds.add(server);
    }
  }
  return Array.from(serverIds).sort();
}

// ---------------------------------------------------------------------------
// Per-server client construction
// ---------------------------------------------------------------------------

/** Stored alongside tokens by the OAuth callback. */
export interface RemoteServerMeta {
  serverUrl: string;
  connectedAt: string;
  connectedBy: string;
}

export class RemoteServerNotConnectedError extends Error {
  constructor(
    public readonly tenant: string,
    public readonly server: string,
  ) {
    super(
      `No OAuth meta found for mcp/${tenant}/${server}. ` +
        'Re-authorize the server via /admin/mcp/connect.',
    );
    this.name = 'RemoteServerNotConnectedError';
  }
}

/**
 * Non-authoritative placeholder; the provider reuses the originally-registered
 * client info saved at `mcp/<tenant>/<server>/client`. Only shape is required
 * by the provider constructor.
 */
const SENTINEL_CLIENT_METADATA: OAuthClientMetadata = {
  redirect_uris: ['http://localhost/unused'],
  client_name: 'RevealUI (runtime)',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

export interface BuildRemoteMcpClientOptions {
  tenant: string;
  server: string;
  /** Injected for tests; defaults to the revvault-backed vault. */
  vault?: Vault;
  /** Client name reported during `initialize`. */
  clientName?: string;
  /** Client version reported during `initialize`. */
  clientVersion?: string;
  /**
   * Handler invoked when the server sends `elicitation/create`. Registered
   * on the `McpClient` at construction time so capability advertisement
   * matches what the caller can actually service.
   */
  elicitationHandler?: ElicitationHandler;
}

export interface BuiltRemoteMcpClient {
  client: McpClient;
  meta: RemoteServerMeta;
}

/**
 * Load OAuth credentials + server URL and return a configured `McpClient`.
 * Throws {@link RemoteServerNotConnectedError} if no meta record exists for
 * the `(tenant, server)` pair.
 */
export async function buildRemoteMcpClient(
  options: BuildRemoteMcpClientOptions,
): Promise<BuiltRemoteMcpClient> {
  const { tenant, server } = options;
  const vault = options.vault ?? createRevvaultVault();

  const metaPath = `mcp/${tenant}/${server}/meta`;
  const rawMeta = await vault.get(metaPath);
  if (!rawMeta) throw new RemoteServerNotConnectedError(tenant, server);
  const meta = parseMeta(rawMeta);

  const provider = new McpOAuthProvider({
    tenant,
    server,
    vault,
    redirectUrl: 'http://localhost/unused',
    clientMetadata: SENTINEL_CLIENT_METADATA,
  });

  const client = new McpClient({
    clientInfo: {
      name: options.clientName ?? 'revealui',
      version: options.clientVersion ?? '0.0.0',
    },
    transport: {
      kind: 'streamable-http',
      url: meta.serverUrl,
      authProvider: provider,
    },
    ...(options.elicitationHandler ? { elicitationHandler: options.elicitationHandler } : {}),
  });

  return { client, meta };
}

function parseMeta(raw: string): RemoteServerMeta {
  const parsed = JSON.parse(raw) as Partial<RemoteServerMeta>;
  if (
    typeof parsed.serverUrl !== 'string' ||
    typeof parsed.connectedAt !== 'string' ||
    typeof parsed.connectedBy !== 'string'
  ) {
    throw new Error('Stored MCP remote-server meta is missing required fields');
  }
  return parsed as RemoteServerMeta;
}
