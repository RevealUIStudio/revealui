#!/usr/bin/env node

/**
 * RevealUI Contracts MCP Server — stdio launcher.
 *
 * Thin wrapper around `createContractsServer()` (see
 * `./factories/contracts.ts` for the full surface). This file exists
 * purely to run the server as a stdio subprocess — the canonical
 * deployment for Claude Code integration, custom-agent integrations, and
 * the hypervisor's `spawn()`-based tool-discovery pipeline.
 *
 * For HTTP / serverless / in-process deployment, import
 * `createContractsServer` directly and wrap it via
 * `createNodeStreamableHttpHandler` from `@revealui/mcp/streamable-http`.
 *
 * **Not Pro-license-gated** — `@revealui/contracts` is MIT and
 * agent-side schema introspection is meant to enable any client
 * (Claude Code, Cursor, custom agents) to integrate cleanly. Pro-gating
 * a public-package primitive would defeat the purpose. Compare with
 * `revealui-content.ts` (Pro-gated) which exposes RevealUI runtime data,
 * not just contracts.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@revealui/core/observability/logger';
import { createContractsServer } from './factories/contracts.js';

async function main(): Promise<void> {
  const server = createContractsServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Contracts MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
