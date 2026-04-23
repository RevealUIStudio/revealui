#!/usr/bin/env node

/**
 * RevealUI Content MCP Server — stdio launcher.
 *
 * Thin wrapper around `createRevealuiContentServer()` (see
 * `./revealui-content-factory.ts` for the tool surface). This file exists
 * purely to run the server as a stdio subprocess — the canonical deployment
 * for local dev, Claude Code integration, and the hypervisor's
 * `spawn()`-based tool-discovery pipeline.
 *
 * For HTTP / serverless / in-process deployment, import the factory
 * directly and wrap it via `createNodeStreamableHttpHandler` from
 * `@revealui/mcp/streamable-http`.
 *
 * Re-exports `setCredentials` for hypervisor compatibility — existing
 * tenant-scoped credential resolution continues to work unchanged.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@revealui/core/observability/logger';
import { checkMcpLicense } from '../index.js';
import { createRevealuiContentServer } from './factories/revealui-content.js';

export { setCredentials } from './factories/revealui-content.js';

async function main(): Promise<void> {
  if (!(await checkMcpLicense())) {
    process.exit(1);
  }
  const server = createRevealuiContentServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Content MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
