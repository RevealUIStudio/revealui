/**
 * Unit tests for {@link listConnectedMcpServers}. Uses the in-memory vault
 * so tests are hermetic — no revvault subprocess, no network.
 */

import { describe, expect, it } from 'vitest';
import { createMemoryVault, RevvaultError } from '../src/oauth.js';
import { listConnectedMcpServers } from '../src/remote-client.js';

describe('listConnectedMcpServers', () => {
  it('returns sorted unique server ids from tokens paths', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/tokens': '{}',
      'mcp/acme/linear/meta': '{}',
      'mcp/acme/linear/client': '{}',
      'mcp/acme/github/tokens': '{}',
      'mcp/acme/github/meta': '{}',
      'mcp/acme/stripe/tokens': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual(['github', 'linear', 'stripe']);
  });

  it('returns empty array when no tokens are present for the tenant', async () => {
    const vault = createMemoryVault({
      'mcp/other-tenant/linear/tokens': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual([]);
  });

  it('ignores paths that are not `tokens` blobs', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/meta': '{}',
      'mcp/acme/linear/client': '{}',
      'mcp/acme/linear/verifier': 'x',
      'mcp/acme/linear/discovery': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual([]);
  });

  it('ignores paths with deeper nesting than `tokens`', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/tokens/extra': '{}',
      'mcp/acme/linear/tokens': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual(['linear']);
  });

  it('ignores server ids containing unsafe characters', async () => {
    // Seed the vault directly with a path that would have been rejected by
    // `set` — simulates a production vault whose entries predate the
    // current validation rules, or a vault shared with another client that
    // writes looser names. The helper should defend against that by
    // re-validating each discovered server id.
    const vault = createMemoryVault({
      'mcp/acme/bad..server/tokens': '{}',
      'mcp/acme/linear/tokens': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual(['linear']);
  });

  it('rejects tenant ids that contain disallowed characters', async () => {
    const vault = createMemoryVault();

    await expect(listConnectedMcpServers(vault, '..')).rejects.toThrow(RevvaultError);
    await expect(listConnectedMcpServers(vault, 'a/b')).rejects.toThrow(RevvaultError);
    await expect(listConnectedMcpServers(vault, '')).rejects.toThrow(RevvaultError);
    await expect(listConnectedMcpServers(vault, 'a'.repeat(65))).rejects.toThrow(RevvaultError);
  });

  it('accepts tenant ids with all permitted characters', async () => {
    const vault = createMemoryVault({
      'mcp/Acme_Corp-1/linear/tokens': '{}',
    });

    const servers = await listConnectedMcpServers(vault, 'Acme_Corp-1');

    expect(servers).toEqual(['linear']);
  });

  it('de-duplicates when multiple entries share the same server id', async () => {
    const vault = createMemoryVault({
      'mcp/acme/linear/tokens': '{}',
      // A later write to the same path wouldn't happen in a real vault, but
      // the enumerator should handle it idempotently regardless.
    });
    // Manually inject a duplicate path via the seed to simulate a historic
    // state; the real-world source for dedup is more like "multiple keys
    // landing under the same server during retry flows".
    await vault.set('mcp/acme/linear/tokens', 'overwritten');

    const servers = await listConnectedMcpServers(vault, 'acme');

    expect(servers).toEqual(['linear']);
  });
});
