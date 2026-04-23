---
'@revealui/mcp': minor
---

Establish the Stage 1 PR-1.2 dual-mode template by refactoring `revealui-content` — the first of 13 first-party MCP servers — to be transport-agnostic. The remaining 12 servers port to the same shape in follow-up PRs.

### Pattern

Each first-party server splits into two files:

| File | Role |
|---|---|
| `servers/factories/<name>.ts` (new) | Exports `create<Name>Server(): Server` + `setCredentials(creds)`. Pure factory, no transport coupling. |
| `servers/<name>.ts` (refactored) | Thin stdio launcher. Imports the factory, connects to `StdioServerTransport`, runs as subprocess. Shebang preserved; hypervisor `spawn()` pipeline unchanged. |

Consumers who need HTTP hosting (admin dashboard, agent runtime, the future Streamable HTTP binary launcher) import the factory directly and wrap it via `createNodeStreamableHttpHandler` from `@revealui/mcp/streamable-http` (PR-1.1).

### This PR ships

- **`packages/mcp/src/servers/factories/revealui-content.ts`** — new. Owns the 5 tools (`revealui_list_sites`, `revealui_list_content`, `revealui_get_content`, `revealui_list_users`, `revealui_site_stats`), credential override mechanism, and REST-proxy helpers. Lives under `servers/factories/` so the `claim-drift` validator's MCP server counter (which reads only the top-level `servers/` directory) doesn't mis-count shared infrastructure as a standalone server.
- **`packages/mcp/src/servers/revealui-content.ts`** — refactored from 314 → 37 lines. Still the canonical stdio entry point. Re-exports `setCredentials` for hypervisor compatibility.
- **`createRevealuiContentServer` + `setRevealuiContentCredentials`** exported from `@revealui/mcp` top-level. External consumers can instantiate + wire credentials without importing from an internal path.

### Testing

3 new integration cases in `packages/mcp/__tests__/revealui-content-factory.integration.test.ts` — factory + `createNodeStreamableHttpHandler` + real HTTP server + `McpClient` + mock upstream REST API:

- Client initializes + discovers the `tools` capability over HTTP
- Tool call proxies through: `McpClient → HTTP handler → factory-created Server → mock REST API`; result body + `_meta` propagated correctly; mock API sees the `Authorization: Bearer …` header
- Missing credentials → tool returns structured error (`isError: true`) with the canonical "REVEALUI_API_URL and REVEALUI_API_KEY must be set" message

MCP total: **164 passing / 5 skipped** (was 161 after PR-1.1).

### Follow-ups

The remaining 12 first-party servers port to this pattern in subsequent PRs — same shape per server:

1. Move the Server instance + handlers into `<name>-factory.ts`, exposing `create<Name>Server()`
2. Reduce `<name>.ts` to ~35 lines (stdio-only shell)
3. Export factory from `@revealui/mcp`

Servers pending port: `code-validator`, `neon`, `next-devtools`, `playwright`, `revealui-email`, `revealui-memory`, `revealui-stripe`, `stripe`, `supabase`, `vercel`, `vultr-test`, `_email-provider`.

See `.jv/docs/mcp-productionization-scope.md` for the full v1 plan.
