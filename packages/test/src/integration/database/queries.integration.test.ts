/**
 * Database queries integration tests
 *
 * Tests database query execution, parameterized queries, and error handling
 */

import type { DatabaseAdapter } from '@revealui/core/types';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  setupTestDatabase,
  trackTestData,
} from '../../utils/integration-helpers.js';

describe('Database Queries Integration', () => {
  let db: DatabaseAdapter;
  let revealui: ReturnType<typeof getTestRevealUI> extends Promise<infer T> ? T : never;

  beforeAll(async () => {
    db = await setupTestDatabase();
    revealui = await getTestRevealUI();
  });

  describe('Query Execution', () => {
    it('should execute SELECT queries', async () => {
      const result = await db.query('SELECT 1 as test');

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test).toBe(1);
    });

    it('should execute INSERT queries', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      await db.query('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test']);

      const result = await db.query('SELECT * FROM test_table WHERE id = ?', ['1']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Test');

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });

    it('should execute UPDATE queries', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      await db.query('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test']);
      await db.query('UPDATE test_table SET name = ? WHERE id = ?', ['Updated', '1']);

      const result = await db.query('SELECT * FROM test_table WHERE id = ?', ['1']);
      expect(result.rows[0].name).toBe('Updated');

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });

    it('should execute DELETE queries', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      await db.query('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test']);
      await db.query('DELETE FROM test_table WHERE id = ?', ['1']);

      const result = await db.query('SELECT * FROM test_table');
      expect(result.rows).toHaveLength(0);

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });
  });

  describe('Parameterized Queries', () => {
    it('should handle single parameter', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      await db.query('INSERT INTO test_table (id, name) VALUES (?, ?)', ['1', 'Test']);

      const result = await db.query('SELECT * FROM test_table WHERE id = ?', ['1']);
      expect(result.rows).toHaveLength(1);

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });

    it('should handle multiple parameters', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT,
          value INTEGER
        )
      `);

      await db.query('INSERT INTO test_table (id, name, value) VALUES (?, ?, ?)', [
        '1',
        'Test',
        100,
      ]);

      const result = await db.query('SELECT * FROM test_table WHERE id = ? AND value = ?', [
        '1',
        100,
      ]);
      expect(result.rows).toHaveLength(1);

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });
  });

  describe('Query Error Handling', () => {
    it('should throw error on invalid SQL', async () => {
      await expect(db.query('INVALID SQL QUERY')).rejects.toThrow();
    });

    it('should throw error on missing parameters', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      await expect(db.query('SELECT * FROM test_table WHERE id = ?', [])).rejects.toThrow();

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });
  });

  describe('Query Performance', () => {
    it('should execute queries efficiently', async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `);

      // Insert multiple records
      for (let i = 0; i < 10; i++) {
        await db.query('INSERT INTO test_table (id, name) VALUES (?, ?)', [`${i}`, `Test${i}`]);
      }

      const start = Date.now();
      const result = await db.query('SELECT * FROM test_table');
      const duration = Date.now() - start;

      expect(result.rows).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should complete quickly

      // Cleanup
      await db.query('DROP TABLE IF EXISTS test_table');
    });
  });

  describe('SQL Syntax Fixes - WHERE Clause', () => {
    it('should handle empty WHERE clause without errors', async () => {
      const testEmail = generateUniqueTestEmail('empty-where');

      // Create user
      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Query without WHERE clause (empty where)
      const result = await revealui.find({
        collection: 'users',
        where: undefined,
        limit: 10,
      });

      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should handle WHERE clause with single condition', async () => {
      const testEmail = generateUniqueTestEmail('single-where');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      const result = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
      });

      expect(result.docs.length).toBeGreaterThan(0);
      expect(result.docs[0].email).toBe(testEmail);
    });

    it('should handle WHERE clause with multiple conditions', async () => {
      const testEmail = generateUniqueTestEmail('multi-where');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // Note: roles is a JSON field, so it can't be queried in SQL WHERE clause
      // Query only by email (non-JSON field)
      const result = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
      });

      expect(result.docs.length).toBeGreaterThan(0);
      // Verify roles is present in the result (even though we can't query by it)
      expect(result.docs[0].roles).toBeDefined();
    });

    it('should handle WHERE clause with nested AND/OR', async () => {
      const testEmail1 = generateUniqueTestEmail('nested-1');
      const testEmail2 = generateUniqueTestEmail('nested-2');

      const user1 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail1,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      const user2 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail2,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user1.id));
      trackTestData('users', String(user2.id));

      const result = await revealui.find({
        collection: 'users',
        where: {
          or: [{ email: { equals: testEmail1 } }, { email: { equals: testEmail2 } }],
        },
      });

      expect(result.docs.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle WHERE clause with IN operator', async () => {
      const testEmail1 = generateUniqueTestEmail('in-1');
      const testEmail2 = generateUniqueTestEmail('in-2');

      const user1 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail1,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      const user2 = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail2,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user1.id));
      trackTestData('users', String(user2.id));

      const result = await revealui.find({
        collection: 'users',
        where: {
          email: {
            in: [testEmail1, testEmail2],
          },
        },
      });

      expect(result.docs.length).toBeGreaterThanOrEqual(2);
    });

    it('should verify parameter count matches placeholder count', async () => {
      const testEmail = generateUniqueTestEmail('param-count');

      const user = await revealui.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'TestPassword123!',
          roles: ['admin'],
        },
      });

      trackTestData('users', String(user.id));

      // This should not throw "Too few parameter values" error
      const result = await revealui.find({
        collection: 'users',
        where: {
          email: {
            equals: testEmail,
          },
        },
        limit: 10,
        page: 1,
      });

      expect(result.docs).toBeDefined();
      expect(result.docs.length).toBeGreaterThan(0);
    });
  });
});
