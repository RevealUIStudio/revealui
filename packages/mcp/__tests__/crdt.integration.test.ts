import { describe, expect, it } from 'vitest';
import adapters from '../src/adapters/db.js';

describe('MCP DB adapter (smoke)', () => {
  it('adapter factory functions are exported', () => {
    expect(typeof adapters.connectPglite).toBe('function');
    expect(typeof adapters.connectPostgres).toBe('function');
    expect(typeof adapters.createMcpDbClient).toBe('function');
  });
});

// Deeper CRDT integration coverage (insert/query/vector-clock) is restored in
// PR-3b.3 against `mcp_document_operations`, a Drizzle-tracked table. The
// previous skip-by-default block here exercised a runtime-bootstrapped
// `crdt_operations` schema removed in PR-3b.1 to close the latent divergence
// with @revealui/ai's canonical `crdt_operations`.
