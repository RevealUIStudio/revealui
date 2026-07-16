/**
 * OAuth 2.1 client provider for `@revealui/mcp`.
 *
 * Phase: Stage 2 PR-2.1 of the MCP v1 plan (see
 * `.jv/docs/mcp-productionization-scope.md`).
 *
 * Implements the SDK's `OAuthClientProvider` interface, backed by a pluggable
 * `Vault` for durable credential storage. The default implementation shells
 * out to the `revvault` CLI; a memory-backed implementation is exported for
 * tests and for environments without revvault on the host.
 *
 * Storage layout per `(tenant, server)` pair, rooted at `mcp/<tenant>/<server>/`:
 *   tokens    — OAuthTokens JSON (access + refresh + expiry + token_type + scope)
 *   client    — DCR client info JSON (client_id + optional client_secret)
 *   verifier  — PKCE code verifier, opaque string, single-use during redirect
 *   discovery — cached authorization-server metadata (optional)
 *
 * Flow (first-time authorization):
 *   1. Caller constructs a provider with `{ tenant, server, vault, redirectUrl,
 *      clientMetadata, onRedirect }` and attaches it to a Streamable HTTP
 *      transport via `authProvider` on `StreamableHttpTransportOptions`.
 *   2. On `connect()`, the SDK transport detects missing tokens, runs OAuth
 *      discovery, performs Dynamic Client Registration (RFC 7591) if
 *      `saveClientInformation` is implemented, generates a PKCE verifier,
 *      persists it, and calls `redirectToAuthorization(url)`.
 *   3. This provider's `redirectToAuthorization` records the URL on
 *      `lastAuthorizationUrl` and invokes the caller's `onRedirect` hook. The
 *      caller navigates the user agent (e.g. a Next.js route handler issuing
 *      an HTTP 302).
 *   4. After the user authorizes and returns to the callback URL, the caller
 *      extracts the `code` query parameter and invokes `mcpClient.finishAuth(code)`,
 *      which delegates to the transport's `finishAuth(code)` — this exchanges
 *      the code via PKCE and persists tokens via `saveTokens`.
 *   5. Subsequent `connect()` calls use the stored tokens. Token refresh is
 *      automatic: the SDK detects expiry, calls the refresh endpoint, and
 *      calls `saveTokens` with the new token set. OAuth 2.1 §4.12 refresh-token
 *      rotation is transparent — the rotated refresh_token flows through
 *      `saveTokens` verbatim.
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  createMemoryVault,
  createRevvaultVault,
  RevvaultError,
  type RevvaultVaultOptions,
  type Vault,
} from '@revealui/setup/revvault';

export {
  createMemoryVault,
  createRevvaultVault,
  RevvaultError,
  type RevvaultVaultOptions,
  type Vault,
};

// ---------------------------------------------------------------------------
// Path layout
// ---------------------------------------------------------------------------

/**
 * Canonical revvault path layout for MCP OAuth credentials. Exported so admin
 * tooling and audits can introspect the layout without reimplementing it.
 */
export interface McpOAuthPaths {
  tokens: string;
  client: string;
  verifier: string;
  discovery: string;
}

/** Build the {@link McpOAuthPaths} for a given `(tenant, server)` pair. */
export function mcpOAuthPaths(tenant: string, server: string): McpOAuthPaths {
  const prefix = `mcp/${tenant}/${server}`;
  return {
    tokens: `${prefix}/tokens`,
    client: `${prefix}/client`,
    verifier: `${prefix}/verifier`,
    discovery: `${prefix}/discovery`,
  };
}

// ---------------------------------------------------------------------------
// RevvaultOAuthProvider
// ---------------------------------------------------------------------------

export interface McpOAuthProviderOptions {
  /** Tenant identifier. Used as the first path segment in revvault. */
  tenant: string;
  /** Server identifier (e.g. `linear`, `notion`). Second path segment. */
  server: string;
  /** Backing vault. Use {@link createRevvaultVault} in production. */
  vault: Vault;
  /**
   * URL the authorization server should redirect to after user consent.
   * This is the public URL of the caller's callback handler.
   */
  redirectUrl: string | URL;
  /**
   * OAuth client metadata used for Dynamic Client Registration and advertised
   * to the authorization server. Must include `redirect_uris` covering
   * `redirectUrl`.
   */
  clientMetadata: OAuthClientMetadata;
  /**
   * Called when the SDK's `auth()` needs to send the user to the authorization
   * URL. The caller is responsible for navigating the user agent (e.g. by
   * issuing an HTTP 302 from a Next.js route handler). The provider also
   * records the URL on {@link RevvaultOAuthProvider.lastAuthorizationUrl} for
   * callers that prefer synchronous inspection over a callback.
   */
  onRedirect?(authorizationUrl: URL): void | Promise<void>;
  /**
   * Generates an opaque OAuth state parameter. Defaults to a `crypto.randomUUID()`.
   * Callers that want to bind state to session identifiers can override.
   */
  state?(): string | Promise<string>;
}

/**
 * SDK-compatible OAuth client provider backed by a {@link Vault}. Instances are
 * scoped to a single `(tenant, server)` pair — construct one per MCP server
 * the caller intends to authorize against.
 */
export class McpOAuthProvider implements OAuthClientProvider {
  private readonly vault: Vault;
  private readonly paths: McpOAuthPaths;
  private readonly _redirectUrl: string | URL;
  private readonly _clientMetadata: OAuthClientMetadata;
  private readonly onRedirect?: (url: URL) => void | Promise<void>;
  private readonly _state?: () => string | Promise<string>;

  /**
   * The most recent authorization URL the SDK asked us to send the user to.
   * Populated by {@link redirectToAuthorization}. Callers may read this
   * synchronously after an `auth()` or `connect()` call that returns
   * `'REDIRECT'`.
   */
  lastAuthorizationUrl?: URL;

  constructor(options: McpOAuthProviderOptions) {
    this.vault = options.vault;
    this.paths = mcpOAuthPaths(options.tenant, options.server);
    this._redirectUrl = options.redirectUrl;
    this._clientMetadata = options.clientMetadata;
    this.onRedirect = options.onRedirect;
    this._state = options.state;
  }

  // -- OAuthClientProvider (getters) ----------------------------------------

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  state(): string | Promise<string> {
    if (this._state) return this._state();
    return crypto.randomUUID();
  }

  // -- OAuthClientProvider (client info) ------------------------------------

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const raw = await this.vault.get(this.paths.client);
    if (raw === undefined) return undefined;
    return parseJson<OAuthClientInformationMixed>(raw, 'client information');
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    await this.vault.set(this.paths.client, JSON.stringify(info));
  }

  // -- OAuthClientProvider (tokens) -----------------------------------------

  async tokens(): Promise<OAuthTokens | undefined> {
    const raw = await this.vault.get(this.paths.tokens);
    if (raw === undefined) return undefined;
    return parseJson<OAuthTokens>(raw, 'tokens');
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.vault.set(this.paths.tokens, JSON.stringify(tokens));
  }

  // -- OAuthClientProvider (PKCE verifier) ----------------------------------

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.vault.set(this.paths.verifier, codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    const value = await this.vault.get(this.paths.verifier);
    if (value === undefined) {
      throw new Error(
        `[@revealui/mcp] PKCE code verifier missing at ${this.paths.verifier}. ` +
          'The authorization flow must call saveCodeVerifier before finishAuth.',
      );
    }
    return value;
  }

  // -- OAuthClientProvider (redirect) ---------------------------------------

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.lastAuthorizationUrl = authorizationUrl;
    if (this.onRedirect) {
      await this.onRedirect(authorizationUrl);
    }
  }

  // -- OAuthClientProvider (invalidation) -----------------------------------

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ): Promise<void> {
    const targets: string[] = [];
    if (scope === 'all' || scope === 'tokens') targets.push(this.paths.tokens);
    if (scope === 'all' || scope === 'client') targets.push(this.paths.client);
    if (scope === 'all' || scope === 'verifier') targets.push(this.paths.verifier);
    if (scope === 'all' || scope === 'discovery') targets.push(this.paths.discovery);
    await Promise.all(targets.map((path) => this.vault.delete(path)));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `[@revealui/mcp] Failed to parse stored ${label} JSON: ${(err as Error).message}`,
    );
  }
}

export type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
};
