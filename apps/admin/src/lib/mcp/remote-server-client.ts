/**
 * Helper for constructing an `McpClient` against an OAuth-authorized remote
 * MCP server using credentials already persisted in the vault.
 *
 * Callers supply `(tenant, server)`. We read the non-credential meta record
 * (`mcp/<tenant>/<server>/meta`) to recover the server URL, then construct
 * an `McpOAuthProvider` that feeds the streamable-http transport. The
 * returned client is configured but NOT yet connected — callers invoke
 * `connect()` themselves so they can manage teardown.
 *
 * Stage 3.2 of the MCP v1 plan.
 */

import { type ElicitationHandler, McpClient } from '@revealui/mcp/client';
import {
  createRevvaultVault,
  McpOAuthProvider,
  type OAuthClientMetadata,
  type Vault,
} from '@revealui/mcp/oauth';

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
  client_name: 'RevealUI Admin (runtime)',
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
      name: options.clientName ?? 'revealui-admin',
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
