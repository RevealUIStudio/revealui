#!/usr/bin/env node

/**
 * revealui-mcp — launch a first-party RevealUI MCP server by name.
 *
 * Usage:
 *   revealui-mcp <server>
 *   npx @revealui/mcp <server>
 *
 * The allowlist is static so no user input ever reaches an import path.
 * code-validator is repo-only (tsx, excluded from the build) and is not
 * listed here.
 *
 * External launchers (neon/stripe/vercel/playwright/next-devtools) export
 * `launch*Mcp` and must not auto-start on import (barrel-safe for GAP-406).
 * First-party stdio servers still self-start on import of their entry file.
 */

const SERVERS: Record<string, () => Promise<unknown>> = {
  contracts: () => import('./servers/contracts.js'),
  docs: () => import('./servers/docs.js'),
  neon: () => import('./servers/neon.js').then((m) => m.launchNeonMcp()),
  'next-devtools': () =>
    import('./servers/next-devtools.js').then((m) => m.launchNextDevtoolsMcp()),
  playwright: () => import('./servers/playwright.js').then((m) => m.launchPlaywrightMcp()),
  'revealui-content': () => import('./servers/revealui-content.js'),
  'revealui-email': () => import('./servers/revealui-email.js'),
  'revealui-memory': () => import('./servers/revealui-memory.js'),
  'revealui-stripe': () => import('./servers/revealui-stripe.js'),
  stripe: () => import('./servers/stripe.js').then((m) => m.launchStripeMcp()),
  vercel: () => import('./servers/vercel.js').then((m) => m.launchVercelMcp()),
};

const requested = process.argv[2];
const launch = requested ? SERVERS[requested] : undefined;

if (!launch) {
  const list = Object.keys(SERVERS).join('\n  ');
  process.stderr.write(`Usage: revealui-mcp <server>\n\nAvailable servers:\n  ${list}\n`);
  process.exit(2);
}

launch().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`revealui-mcp: failed to start ${requested}: ${message}\n`);
  process.exit(1);
});
