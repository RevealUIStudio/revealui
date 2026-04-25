---
'@revealui/mcp': minor
---

Stage 3.2 of the MCP v1 plan — tool browser + ad-hoc invoker for connected
remote MCP servers. Builds on Stages 2 + 3.1.

**`@revealui/mcp`:**
- `McpClient.listTools()` and `callTool(name, arguments?)` — full-protocol
  tool coverage, following the Stage 0 pattern (capability-gated,
  per-request options threaded through). Tool failures surface in-band
  (`isError: true, content: [...]`) rather than throwing — transport-level
  failures still throw. Stage 0 deliberately skipped tools because the
  hypervisor handled stdio tool calls through its own JSON-RPC; Stage 3.2
  needs them for remote HTTP servers.
- `Tool` and `CallToolResult` types exported.
- New `@revealui/mcp/client` subpath export — admin/edge consumers can
  import the client surface without pulling in the stdio launcher scripts
  that auto-execute and call `checkMcpLicense()` during bundling.

**admin:**
- OAuth callback now writes a non-credential meta record at
  `mcp/<tenant>/<server>/meta` (`serverUrl` + `connectedAt` + `connectedBy`)
  so subsequent tool calls know where to connect. Best-effort — tokens
  remain the load-bearing state.
- `lib/mcp/remote-server-client.ts` — helper that rebuilds an `McpClient`
  from stored credentials for a given `(tenant, server)`.
- Three new per-server routes:
  - `GET /api/mcp/remote-servers/[server]/tools?tenant=X` — lists tools.
  - `POST /api/mcp/remote-servers/[server]/call-tool` — invokes a tool.
  - `POST /api/mcp/remote-servers/[server]/complete` — prompt / resource
    argument completions (the completions protocol is for prompts +
    resource templates, not tool arguments).
- `/admin/mcp/inspect?tenant=X&server=Y` — tool browser page. Renders each
  tool's `inputSchema` as a form (best-effort: strings, numbers, booleans,
  enums, JSON for complex types), invokes the tool, displays the
  `CallToolResult` content blocks.
- Catalog page (`/admin/mcp`) gets a per-row "Inspect" link.
