#!/usr/bin/env node
/**
 * GAP-414 — keep packages/mcp/server.json version fields locked to package.json.
 *
 * `pnpm changeset:version` only rewrites package.json; the MCP registry metadata
 * carries the same version in two fields. This post-step rewrites both from
 * package.json so version PRs do not fail server-json.test.ts.
 *
 * Zero authored regex: JSON.parse / JSON.stringify only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'packages/mcp/package.json');
const serverPath = join(root, 'packages/mcp/server.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const server = JSON.parse(readFileSync(serverPath, 'utf8'));

const version = pkg.version;
if (typeof version !== 'string' || version.length === 0) {
  console.error('sync-mcp-server-json: packages/mcp/package.json has no version');
  process.exit(1);
}

server.version = version;
if (!Array.isArray(server.packages) || !server.packages[0]) {
  console.error('sync-mcp-server-json: server.json missing packages[0]');
  process.exit(1);
}
server.packages[0].version = version;

writeFileSync(serverPath, `${JSON.stringify(server, null, 2)}\n`, 'utf8');
console.log(`sync-mcp-server-json: packages/mcp/server.json → ${version}`);
