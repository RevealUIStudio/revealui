---
"@revealui/mcp": patch
---

Add a `revealui-mcp` bin launcher, the `mcpName` field, and `server.json` so the package is listable on the MCP Registry (registry.modelcontextprotocol.io) and runnable straight from npm: `npx @revealui/mcp <server>`. The launcher is a static allowlist over the servers already shipped in `dist/servers/`; no behavior change to any server.
