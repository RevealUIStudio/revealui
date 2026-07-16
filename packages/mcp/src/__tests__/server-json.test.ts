import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const serverJson = JSON.parse(readFileSync(new URL('../../server.json', import.meta.url), 'utf8'));

// The MCP Registry rejects a server.json whose version differs from the
// published npm version, and nothing bumps server.json automatically
// (changesets only touches package.json). These assertions force the
// version-bump PR to update server.json in lockstep.
describe('server.json registry metadata', () => {
  it('tracks package.json version at top level', () => {
    expect(serverJson.version).toBe(pkg.version);
  });

  it('tracks package.json version in the npm package entry', () => {
    expect(serverJson.packages[0].version).toBe(pkg.version);
  });

  it('has a name matching package.json mcpName (registry ownership check)', () => {
    expect(serverJson.name).toBe(pkg.mcpName);
  });

  it('points at this package on npm', () => {
    expect(serverJson.packages[0].identifier).toBe(pkg.name);
  });
});
