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

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// ---------------------------------------------------------------------------
// Vault interface (pluggable KV for provider state)
// ---------------------------------------------------------------------------

/**
 * Minimal key/value interface the provider needs from its backing store.
 *
 * Keys are revvault-style slash-delimited paths (e.g. `mcp/acme/linear/tokens`).
 * Values are opaque strings; the provider JSON-encodes structured values
 * before calling `set`.
 */
export interface Vault {
  /** Returns the value at `path`, or `undefined` if not present. */
  get(path: string): Promise<string | undefined>;
  /** Stores `value` at `path`, overwriting any prior value. */
  set(path: string, value: string): Promise<void>;
  /** Deletes the value at `path`. No-op if not present. */
  delete(path: string): Promise<void>;
  /**
   * Lists every path that starts with `prefix`. Returns an empty array when
   * no matches exist. The return order is implementation-defined.
   *
   * Used by admin catalog tooling to enumerate configured servers without
   * requiring an out-of-band registry.
   */
  list(prefix: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Revvault-backed vault (default)
// ---------------------------------------------------------------------------

export interface RevvaultVaultOptions {
  /** Path to the `revvault` binary. Defaults to `~/.local/bin/revvault`. */
  binPath?: string;
  /**
   * Age identity path. Passed via `REVVAULT_IDENTITY` env var. Defaults to
   * `~/.config/age/keys.txt`, matching revvault's own default.
   */
  identityPath?: string;
  /** Spawn timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
}

/**
 * Creates a {@link Vault} backed by the `revvault` CLI. Requires `revvault` to
 * be installed on the host and the age identity to be readable.
 *
 * Production default for RevealUI deployments. In CI or test environments
 * without revvault, prefer {@link createMemoryVault}.
 */
export function createRevvaultVault(options: RevvaultVaultOptions = {}): Vault {
  const binPath = options.binPath ?? join(homedir(), '.local/bin/revvault');
  const identityPath =
    options.identityPath ??
    process.env.REVVAULT_IDENTITY ??
    join(homedir(), '.config/age/keys.txt');
  const timeoutMs = options.timeoutMs ?? 10_000;

  const env = { ...process.env, REVVAULT_IDENTITY: identityPath };

  const run = (
    args: string[],
    stdin?: string,
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(binPath, args, { env, timeout: timeoutMs });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      if (stdin !== undefined) {
        child.stdin.end(stdin);
      } else {
        child.stdin.end();
      }
    });

  return {
    async get(path) {
      assertSafePath(path);
      const { code, stdout, stderr } = await run(['get', '--full', path]);
      if (code !== 0) {
        throw new RevvaultError(`revvault get exited ${code}: ${stderr.trim()}`);
      }
      if (stdout.length === 0 && /not found/i.test(stderr)) {
        return undefined;
      }
      if (stdout.length === 0) {
        throw new RevvaultError(`revvault get returned empty output: ${stderr.trim()}`);
      }
      return stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
    },
    async set(path, value) {
      assertSafePath(path);
      const { code, stderr } = await run(['set', '--force', path], value);
      if (code !== 0) {
        throw new RevvaultError(`revvault set exited ${code}: ${stderr.trim()}`);
      }
    },
    async delete(path) {
      assertSafePath(path);
      const { code, stderr } = await run(['delete', '--force', path]);
      if (code !== 0 && !/not found/i.test(stderr)) {
        throw new RevvaultError(`revvault delete exited ${code}: ${stderr.trim()}`);
      }
    },
    async list(prefix) {
      assertSafePrefix(prefix);
      const { code, stdout, stderr } = await run(['list', prefix]);
      if (code !== 0) {
        throw new RevvaultError(`revvault list exited ${code}: ${stderr.trim()}`);
      }
      // `revvault list` emits one path per line. Empty / informational output
      // (e.g. `No secrets found.`) returns an empty array.
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.startsWith(prefix));
    },
  };
}

/** Reject shell-metacharacter and traversal patterns in vault paths. */
function assertSafePath(path: string): void {
  if (!/^[A-Za-z0-9/_\-.]+$/.test(path)) {
    throw new RevvaultError(`Vault path contains disallowed characters: ${path}`);
  }
  if (path.includes('..') || path.startsWith('/') || path.endsWith('/')) {
    throw new RevvaultError(`Vault path is not well-formed: ${path}`);
  }
}

/** Same rules as {@link assertSafePath} but allows the trailing slash of a prefix. */
function assertSafePrefix(prefix: string): void {
  if (!/^[A-Za-z0-9/_\-.]+$/.test(prefix)) {
    throw new RevvaultError(`Vault prefix contains disallowed characters: ${prefix}`);
  }
  if (prefix.includes('..') || prefix.startsWith('/')) {
    throw new RevvaultError(`Vault prefix is not well-formed: ${prefix}`);
  }
}

export class RevvaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevvaultError';
  }
}

// ---------------------------------------------------------------------------
// In-memory vault (tests / ephemeral flows)
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory {@link Vault} backed by a `Map`. Intended for tests and
 * for short-lived processes where persistence is not required.
 *
 * An optional `seed` object prepopulates the map.
 */
export function createMemoryVault(seed?: Record<string, string>): Vault {
  const store = new Map<string, string>(seed ? Object.entries(seed) : undefined);
  return {
    async get(path) {
      return store.get(path);
    },
    async set(path, value) {
      store.set(path, value);
    },
    async delete(path) {
      store.delete(path);
    },
    async list(prefix) {
      const out: string[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) out.push(key);
      }
      return out;
    },
  };
}

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
