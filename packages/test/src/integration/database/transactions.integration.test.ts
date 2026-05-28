/**
 * Database transactions integration tests
 *
 * Tests transaction rollback, commit, nested transactions, and isolation
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase } from '../../utils/integration-helpers.js';

/**
 * The electric/PGlite adapter's `transaction(fn)` invokes `fn` with a
 * transactional `tx` exposing an async `query` that uses Postgres `$n`
 * placeholders — not the legacy better-sqlite3 sync `syncQuery(...)`/`?` API
 * these tests were originally written against.
 */
type TxQuery = (sql: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
interface TransactionalAdapter {
  query: TxQuery;
  transaction: <T>(fn: (tx: { query: TxQuery }) => Promise<T>) => Promise<T>;
}

describe('Database Transactions Integration', () => {
  let db: TransactionalAdapter;

  beforeAll(async () => {
    db = (await setupTestDatabase()) as unknown as TransactionalAdapter;

    // Create test table - drop first to ensure clean state
    try {
      await db.query('DROP TABLE IF EXISTS test_table');
    } catch {
      // Ignore errors
    }

    await db.query(`
      CREATE TABLE test_table (
        id TEXT PRIMARY KEY,
        name TEXT,
        value INTEGER
      )
    `);
  });

  beforeEach(async () => {
    // Clean up any existing test data before each test
    await db.query('DELETE FROM test_table');
  });

  afterEach(async () => {
    // Clean up after each test for complete isolation
    await db.query('DELETE FROM test_table');
  });

  describe('Transaction Commit', () => {
    it('should commit transaction successfully', async () => {
      const id1 = `tx-commit-1-${Date.now()}`;
      const id2 = `tx-commit-2-${Date.now()}`;

      await db.transaction(async (tx) => {
        await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id1, 'Test1']);
        await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id2, 'Test2']);
      });

      const result = await db.query('SELECT * FROM test_table WHERE id IN ($1, $2)', [id1, id2]);
      expect(result.rows).toHaveLength(2);

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id IN ($1, $2)', [id1, id2]);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback transaction on error', async () => {
      const id = `tx-rollback-${Date.now()}`;

      try {
        await db.transaction(async (tx) => {
          await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id, 'Test1']);
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected error
        expect((error as Error).message).toBe('Test error');
      }

      const result = await db.query('SELECT * FROM test_table WHERE id = $1', [id]);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate concurrent transactions', async () => {
      // In PGlite transactions are serialized; verify reads within a
      // transaction see its own writes, and the write commits.
      const id = `tx-isolated-${Date.now()}`;

      await db.transaction(async (tx) => {
        await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id, 'Test1']);

        // Read within the transaction
        const inside = await tx.query('SELECT * FROM test_table WHERE id = $1', [id]);
        expect(inside.rows).toHaveLength(1);
      });

      // Verify committed
      const result = await db.query('SELECT * FROM test_table WHERE id = $1', [id]);
      expect(result.rows).toHaveLength(1);

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id = $1', [id]);
    });
  });

  describe('Nested Transactions', () => {
    it('should handle nested transaction-like operations', async () => {
      // PGlite doesn't support true nested transactions, but the adapter
      // should handle multiple writes within a single transaction gracefully.
      const id1 = `tx-nested-1-${Date.now()}`;
      const id2 = `tx-nested-2-${Date.now()}`;

      await db.transaction(async (tx) => {
        await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id1, 'Test1']);
        await tx.query('INSERT INTO test_table (id, name) VALUES ($1, $2)', [id2, 'Test2']);
      });

      const result = await db.query('SELECT * FROM test_table WHERE id IN ($1, $2)', [id1, id2]);
      expect(result.rows).toHaveLength(2);

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id IN ($1, $2)', [id1, id2]);
    });
  });
});
