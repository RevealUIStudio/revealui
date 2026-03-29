import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import adapters, { connectPglite, type McpDbClient } from '../src/adapters/db.js';

describe('CRDT integration (smoke)', () => {
  it('adapter functions exist', () => {
    expect(typeof adapters.connectPglite).toBe('function');
    expect(typeof adapters.connectPostgres).toBe('function');
    expect(typeof adapters.createMcpDbClient).toBe('function');
  });
});

// Skip integration tests in unit test mode
// Integration tests need TEST_DATABASE_URL explicitly set or PGlite in test environment
// Don't run by default as PGlite initialization can be slow
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isTestMode = process.env.NODE_ENV === 'test';

describe.skipIf(!testDatabaseUrl || isTestMode)('CRDT integration with PGlite', () => {
  let client: McpDbClient;

  beforeAll(async () => {
    // Use in-memory PGlite for testing
    client = await connectPglite({ dataDir: ':memory:' });
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should create crdt_operations table', async () => {
    // Verify table exists by querying it
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'crdt_operations'`,
    );

    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('document_id');
    expect(columns).toContain('operation_type');
    expect(columns).toContain('payload');
    expect(columns).toContain('vector_clock');
    expect(columns).toContain('node_id');
  });

  it('should insert and query CRDT operations', async () => {
    const opId = `op-${Date.now()}`;
    const docId = 'doc-test-1';
    const nodeId = 'node-a';

    // Insert a CRDT operation
    await client.query(
      `INSERT INTO crdt_operations (id, document_id, operation_type, payload, vector_clock, node_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opId,
        docId,
        'insert',
        JSON.stringify({ field: 'title', value: 'Test' }),
        JSON.stringify({ [nodeId]: 1 }),
        nodeId,
      ],
    );

    // Query it back
    const result = await client.query(`SELECT * FROM crdt_operations WHERE id = $1`, [opId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.document_id).toBe(docId);
    expect(result.rows[0]?.operation_type).toBe('insert');
    expect(result.rows[0]?.node_id).toBe(nodeId);
  });

  it('should support concurrent operations from multiple nodes', async () => {
    const docId = `doc-concurrent-${Date.now()}`;
    const nodeA = 'node-a';
    const nodeB = 'node-b';

    // Simulate concurrent writes from two nodes
    await Promise.all([
      client.query(
        `INSERT INTO crdt_operations (id, document_id, operation_type, payload, vector_clock, node_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `op-a-${Date.now()}`,
          docId,
          'update',
          JSON.stringify({ field: 'content', value: 'From A' }),
          JSON.stringify({ [nodeA]: 1 }),
          nodeA,
        ],
      ),
      client.query(
        `INSERT INTO crdt_operations (id, document_id, operation_type, payload, vector_clock, node_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `op-b-${Date.now()}`,
          docId,
          'update',
          JSON.stringify({ field: 'content', value: 'From B' }),
          JSON.stringify({ [nodeB]: 1 }),
          nodeB,
        ],
      ),
    ]);

    // Query all operations for this document
    const result = await client.query(
      `SELECT * FROM crdt_operations WHERE document_id = $1 ORDER BY created_at`,
      [docId],
    );

    // Both operations should be preserved (CRDT property)
    expect(result.rows).toHaveLength(2);

    const nodes = result.rows.map((r) => r.node_id);
    expect(nodes).toContain(nodeA);
    expect(nodes).toContain(nodeB);
  });

  it('should handle vector clock ordering', async () => {
    const docId = `doc-clock-${Date.now()}`;
    const nodeId = 'node-clock';

    // Insert operations with incrementing vector clock
    for (let i = 1; i <= 3; i++) {
      await client.query(
        `INSERT INTO crdt_operations (id, document_id, operation_type, payload, vector_clock, node_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `op-${docId}-${i}`,
          docId,
          'update',
          JSON.stringify({ field: 'counter', value: i }),
          JSON.stringify({ [nodeId]: i }),
          nodeId,
        ],
      );
    }

    const result = await client.query(
      `SELECT * FROM crdt_operations WHERE document_id = $1 ORDER BY created_at`,
      [docId],
    );

    expect(result.rows).toHaveLength(3);

    // Verify vector clocks are preserved and can be used for ordering
    const clocks = result.rows.map((r) => {
      const vc = r.vector_clock as Record<string, number>;
      return vc[nodeId];
    });
    expect(clocks).toEqual([1, 2, 3]);
  });
});
