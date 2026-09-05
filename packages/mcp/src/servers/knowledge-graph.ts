#!/usr/bin/env node

/**
 * Knowledge-graph MCP server — stdio launcher (studio-local).
 *
 * `revealui-mcp knowledge-graph` and a direct node/tsx run of this file.
 * Uses `isDirectEntry` so importing the module (tests, a future barrel)
 * cannot `process.exit` the host. Do not copy docs.ts auto-`main()` on import.
 *
 * Product mode + studio-local. Principal comes from REVDEV_AGENT_ID (or the
 * daemon session cache for this ppid) plus the hook-identity file. Missing
 * identity WARNs once per process and tool calls return principal-missing.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadStudioPrincipal, warnMissingPrincipal } from './_kg-principal.js';
import { createLauncherLogger, ExitCode, isDirectEntry } from './_launcher-utils.js';
import {
  createKnowledgeGraphServer,
  DEFAULT_KG_TOOL_TIMEOUT_MS,
} from './factories/knowledge-graph.js';

const logger = createLauncherLogger();

export async function launchKnowledgeGraphMcp(): Promise<void> {
  const server = createKnowledgeGraphServer({
    mode: 'product',
    trustBoundary: 'studio-local',
    timeoutMs: DEFAULT_KG_TOOL_TIMEOUT_MS,
    principalProvider: async () => {
      const principal = loadStudioPrincipal();
      if (!principal) warnMissingPrincipal(logger);
      return principal;
    },
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main(): Promise<void> {
  try {
    await launchKnowledgeGraphMcp();
  } catch (error) {
    logger.error(
      `knowledge-graph MCP failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(ExitCode.EXECUTION_ERROR);
  }
}

if (isDirectEntry(import.meta.url)) {
  void main();
}
