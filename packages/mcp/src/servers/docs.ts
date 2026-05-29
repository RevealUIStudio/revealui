#!/usr/bin/env node

/**
 * RevealUI Docs MCP Server — stdio launcher.
 *
 * Thin wrapper around `createDocsServer()` (see `./factories/docs.ts` for the
 * full surface). Resolves the monorepo root so the server can read first-party
 * `@revealui/*` packages, then speaks stdio-MCP — the canonical deployment for
 * Claude Code / custom-agent integration and the hypervisor's spawn pipeline.
 *
 * Root resolution order:
 *   1. `REVEALUI_ROOT` env var (when it contains a `pnpm-workspace.yaml`).
 *   2. Walk up from `process.cwd()` to the first dir with `pnpm-workspace.yaml`.
 *   3. Fall back to `process.cwd()` (the server then enumerates zero packages).
 *
 * **Not** Pro-license-gated — see the factory header for the rationale.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@revealui/core/observability/logger';
import { createDocsServer } from './factories/docs.js';

function resolveMonorepoRoot(): string {
  const fromEnv = process.env.REVEALUI_ROOT;
  if (fromEnv && existsSync(join(fromEnv, 'pnpm-workspace.yaml'))) return fromEnv;

  let dir = process.cwd();
  for (let depth = 0; depth < 64; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

async function main(): Promise<void> {
  const server = createDocsServer({ root: resolveMonorepoRoot() });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Docs MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
