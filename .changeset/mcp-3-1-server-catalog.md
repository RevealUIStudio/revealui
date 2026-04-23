---
'@revealui/mcp': minor
'admin': minor
---

Stage 3.1 of the MCP v1 plan — admin-side server catalog for OAuth-authorized
remote servers plus a disconnect action.

**`@revealui/mcp`:**
- `Vault.list(prefix)` on the core interface. Returns every path under
  `prefix`. `createRevvaultVault()` shells out to `revvault list <prefix>`
  and parses line-oriented output; `createMemoryVault()` implements the
  same semantics over its `Map`. Enables catalog tooling to enumerate
  configured servers without an out-of-band registry.

**admin:**
- `GET /api/mcp/remote-servers?tenant=X` — enumerates OAuth-authorized
  servers for a tenant by walking `mcp/<tenant>/<server>/tokens`. Returns
  `{ tenant, server, connectionState: 'connected' }[]`. Reserved tenant
  segments (e.g. `oauth`) are rejected.
- `POST /api/mcp/remote-servers/[server]/disconnect` — revokes every
  credential path for `(tenant, server)` via
  `McpOAuthProvider.invalidateCredentials('all')`. Idempotent.
- `/admin/mcp` — server catalog page. Lists built-in servers (shared
  endpoint with `/admin/agents` MCP tab) plus remote servers for the
  entered tenant, with disconnect action and a "Connect new server"
  link to the existing `/admin/mcp/connect` flow.
