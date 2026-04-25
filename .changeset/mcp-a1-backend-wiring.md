---
'@revealui/mcp': minor
---

A.1 of the post-v1 MCP arc — first production consumer of Stage 5 + Stage 6
primitives at `/api/agent-stream`. `usage_meters` rows now flow for real
agent runs whose session resolves to a billing account, and MCP protocol
events land in the central log aggregator.

**`@revealui/mcp`:**
- New `@revealui/mcp/remote-client` export. Extracts the admin-local
  `buildRemoteMcpClient` + adds `listConnectedMcpServers(vault, tenant)` so
  the API app can discover a tenant's OAuth-authorized servers and connect
  to them without duplicating admin code.

**`api`:**
- New `apps/api/src/lib/metering.ts` — `recordUsageMeter()` thin writer
  around `db.insert(usageMeters).values(row).onConflictDoNothing()`.
  `@revealui/db` stays schema-only.
- `apps/api/src/routes/agent-stream.ts` resolves the tenant (from
  `X-Tenant-ID` via `tenantMiddleware`) and the `accountId` (from the
  global `entitlementMiddleware`), builds `McpClient`s for every
  OAuth-authorized server the tenant has, merges those tools into the
  agent's tool list, and composes an `onEvent` sink that fans Stage 6.1
  protocol events into `createCoreLoggerSink()` plus — when `accountId`
  is known — `createUsageMeterSink({ accountId, write: recordUsageMeter })`.
- Safe fallbacks hold the existing behavior when a request has no tenant
  or no active account membership: empty `mcpClients`, logger-only sink.
- MCP clients opened during the request are closed in the streamSSE
  finally so sockets + OAuth-refresh timers don't leak.

**`admin`:**
- `apps/admin/src/lib/mcp/remote-server-client.ts` becomes a re-export
  shim pointing at `@revealui/mcp/remote-client`; existing admin route
  imports keep working untouched.
- `apps/admin/src/app/api/mcp/remote-servers/route.ts` consumes the
  shared `listConnectedMcpServers` helper instead of the inline
  enumeration.
