---
"@revealui/mcp": minor
---

Remove unused vendor HTTP-adapter subclasses from the public API: `VercelAdapter`, `StripeAdapter`, `NeonAdapter`, and the `createMCPAdapter` factory. These were exported from `packages/mcp/src/servers/adapter.ts` but had zero consumers anywhere in the monorepo - the live vendor integrations are the stdio MCP-server launchers in `servers/{stripe,neon,vercel}.ts` (which spawn upstream `@stripe/mcp`, `mcp-server-neon`, and `vercel-mcp` under the hypervisor), not these HTTP wrappers. The `MCPAdapter` base class, `disposeAllAdapters`, idempotency-key helpers, and adapter-framework types remain exported so future first-party adapters can still extend the base. The integration test suite under `scripts/__tests__/integration/` already targets the standalone `scripts/mcp/adapter.ts` framework and is unaffected.
