/**
 * MCP — Connect Server (/admin/mcp/connect)
 *
 * Minimal admin UI for initiating an OAuth 2.1 flow against a remote MCP
 * server. Submits a GET to `/api/mcp/oauth/initiate`, which runs discovery,
 * Dynamic Client Registration, and PKCE, then 302-redirects the user to the
 * authorization server. After consent, the user lands back here with either
 * `?connected=<server>` or `?error=<reason>`.
 *
 * Generic flow per Stage 2 PR-2.2: no per-server branding. Polished per-server
 * UX lands with RevMarket in v1.1. Token storage is handled by the API layer
 * via the revvault-backed `McpOAuthProvider`.
 */

type SearchParamValue = string | string[] | undefined;

function firstString(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

type PageSearchParams = Promise<Record<string, SearchParamValue>>;

export default async function ConnectMcpServerPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const connected = firstString(params.connected);
  const error = firstString(params.error);
  const detail = firstString(params.detail);
  const serverFromResult = firstString(params.server);

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Connect MCP Server</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Authorize a remote Model Context Protocol server via OAuth 2.1
        </p>
      </div>

      <div className="mx-auto max-w-2xl p-6">
        {connected && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-emerald-800 bg-emerald-900/20 p-4 text-sm text-emerald-300"
          >
            Connected to <span className="font-mono font-semibold">{connected}</span>. Tokens are
            stored in revvault under{' '}
            <span className="font-mono">mcp/&lt;tenant&gt;/{connected}/tokens</span>.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300"
          >
            <div className="font-semibold">
              Authorization failed{serverFromResult ? ` for ${serverFromResult}` : ''}
            </div>
            <div className="mt-1 text-xs text-red-400">
              <span className="font-mono">{error}</span>
              {detail ? <span className="ml-2 text-red-500">— {detail}</span> : null}
            </div>
          </div>
        )}

        <form
          method="GET"
          action="/api/mcp/oauth/initiate"
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="grid gap-4">
            <div>
              <label htmlFor="tenant" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Tenant
              </label>
              <input
                id="tenant"
                name="tenant"
                type="text"
                required
                pattern="[A-Za-z0-9_-]{1,64}"
                placeholder="acme"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Identifier under which tokens are scoped in revvault. Alphanumeric, underscore,
                hyphen.
              </p>
            </div>

            <div>
              <label htmlFor="server" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Server name
              </label>
              <input
                id="server"
                name="server"
                type="text"
                required
                pattern="[A-Za-z0-9_-]{1,64}"
                placeholder="linear"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Short identifier for this MCP server. Used as the revvault path segment.
              </p>
            </div>

            <div>
              <label htmlFor="serverUrl" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Server URL
              </label>
              <input
                id="serverUrl"
                name="serverUrl"
                type="url"
                required
                placeholder="https://mcp.example.com"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                The MCP server&rsquo;s base URL. Must be HTTPS in production (localhost allowed for
                dev).
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Authorize
            </button>
            <span className="text-xs text-zinc-500">
              You&rsquo;ll be redirected to the server&rsquo;s consent screen.
            </span>
          </div>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <h3 className="text-sm font-medium text-zinc-300">How it works</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-500">
            <li>
              The server discovers OAuth metadata via RFC 9728 / RFC 8414 well-known endpoints.
            </li>
            <li>
              If the server supports Dynamic Client Registration (RFC 7591), a client is registered
              on the fly.
            </li>
            <li>
              A PKCE verifier is generated and stored, then you&rsquo;re redirected to the
              authorization endpoint.
            </li>
            <li>
              After consent, the callback exchanges the code for tokens and persists them in
              revvault.
            </li>
            <li>
              Refresh rotation is handled automatically by the MCP client on subsequent connections.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
