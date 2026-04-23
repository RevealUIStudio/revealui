import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import adapters, { connectPostgres, type McpDbClient } from '../src/adapters/db.js';

describe('MCP DB adapter (smoke)', () => {
  it('adapter factory functions are exported', () => {
    expect(typeof adapters.connectPglite).toBe('function');
    expect(typeof adapters.connectPostgres).toBe('function');
    expect(typeof adapters.createMcpDbClient).toBe('function');
  });
});

// Integration tests run only when TEST_DATABASE_URL points at a Postgres that
// already has drizzle-kit migrations applied through
// `0009_mcp_document_operations.sql`. Skipped by default so `pnpm test` stays
// hermetic; enabling the block is a conscious opt-in by whoever has a seeded
// DB handy (e.g. `pgvector/pgvector:pg16` from the CI migrations job).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isTestMode = process.env.NODE_ENV === 'test';

describe.skipIf(!testDatabaseUrl || isTestMode)('mcp_document_operations (integration)', () => {
  let client: McpDbClient;

  beforeAll(async () => {
    // connectPostgres reads from POSTGRES_URL / DATABASE_URL — point it at
    // the test DB for the duration of this block.
    process.env.POSTGRES_URL = testDatabaseUrl;
    client = await connectPostgres();
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('exposes the expected column set', async () => {
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'mcp_document_operations'
         ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((r) => r.column_name);
    expect(columns).toEqual([
      'id',
      'document_id',
      'operation_type',
      'payload',
      'vector_clock',
      'node_id',
      'created_at',
      'applied_at',
    ]);
  });

  it('inserts and queries an operation round-trip', async () => {
    const opId = `op-${Date.now()}`;
    const docId = `doc-roundtrip-${Date.now()}`;
    const nodeId = 'node-a';

    await client.query(
      `INSERT INTO mcp_document_operations (id, document_id, operation_type, payload, vector_clock, node_id)
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

    const result = await client.query(`SELECT * FROM mcp_document_operations WHERE id = $1`, [
      opId,
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.document_id).toBe(docId);
    expect(result.rows[0]?.operation_type).toBe('insert');
    expect(result.rows[0]?.node_id).toBe(nodeId);
    expect(result.rows[0]?.applied_at).toBeNull();
  });

  it('preserves concurrent operations from multiple nodes', async () => {
    const docId = `doc-concurrent-${Date.now()}`;
    const nodeA = 'node-a';
    const nodeB = 'node-b';

    await Promise.all([
      client.query(
        `INSERT INTO mcp_document_operations (id, document_id, operation_type, payload, vector_clock, node_id)
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
        `INSERT INTO mcp_document_operations (id, document_id, operation_type, payload, vector_clock, node_id)
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

    const result = await client.query(
      `SELECT * FROM mcp_document_operations WHERE document_id = $1 ORDER BY created_at`,
      [docId],
    );

    expect(result.rows).toHaveLength(2);
    const nodes = result.rows.map((r) => r.node_id);
    expect(nodes).toContain(nodeA);
    expect(nodes).toContain(nodeB);
  });

  it('preserves vector-clock ordering within a single node', async () => {
    const docId = `doc-clock-${Date.now()}`;
    const nodeId = 'node-clock';

    for (let i = 1; i <= 3; i++) {
      await client.query(
        `INSERT INTO mcp_document_operations (id, document_id, operation_type, payload, vector_clock, node_id)
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
      `SELECT * FROM mcp_document_operations WHERE document_id = $1 ORDER BY created_at`,
      [docId],
    );

    expect(result.rows).toHaveLength(3);
    const clocks = result.rows.map((r) => {
      const vc = r.vector_clock as Record<string, number>;
      return vc[nodeId];
    });
    expect(clocks).toEqual([1, 2, 3]);
  });

  it('accepts applied_at marker for idempotent replay', async () => {
    const opId = `op-applied-${Date.now()}`;
    const docId = `doc-applied-${Date.now()}`;
    const nodeId = 'node-applied';

    await client.query(
      `INSERT INTO mcp_document_operations (id, document_id, operation_type, payload, vector_clock, node_id, applied_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        opId,
        docId,
        'insert',
        JSON.stringify({ field: 'title', value: 'Applied' }),
        JSON.stringify({ [nodeId]: 1 }),
        nodeId,
      ],
    );

    const result = await client.query(
      `SELECT applied_at FROM mcp_document_operations WHERE id = $1`,
      [opId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.applied_at).not.toBeNull();
  });
});
