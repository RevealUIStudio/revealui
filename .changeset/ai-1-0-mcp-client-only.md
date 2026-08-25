---
'@revealui/ai': major
---

Remove the legacy hypervisor MCP agent adapter. Mount MCP tools with `createToolsFromMcpClient` / `mcpClients` only. Deleted public surface: `discoverMCPTools`, `MCPToolSource`, `AgentRuntime.mcpToolSource`, `createToolFromMCP`, `registerMCPTools`. `MCPHypervisor` in `@revealui/mcp` is unchanged — connect spawned servers with a real `McpClient`.
