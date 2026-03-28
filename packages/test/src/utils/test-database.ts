/**
 * Test database utilities
 *
 * Provides utilities for test database setup, teardown, seeding, and cleanup
 */

import fs from 'node:fs';
import { universalPostgresAdapter } from '@revealui/core';
import type { DatabaseAdapter } from '@revealui/core/types';

type TestDatabaseAdapter = DatabaseAdapter & {
  __testDbPath?: string;
  transaction: (callback: (syncQuery?: unknown) => void | Promise<void>) => Promise<void>;
};

let testDb: TestDatabaseAdapter | null = null;

/**
 * Setup test database
 */
export async function setupTestDatabase(dbPath?: string): Promise<DatabaseAdapter> {
  if (testDb) {
    return testDb;
  }

  // Use PGlite (electric) as an in-memory/local Postgres-compatible adapter for tests
  // Provide a simple compatibility wrapper that converts '?' placeholders to $1, $2, ...
  const base = universalPostgresAdapter({ provider: 'electric' });

  const compat: TestDatabaseAdapter & { close?: () => Promise<void> } = {
    async init() {
      // no-op for pglite
      await Promise.resolve();
    },
    async connect() {
      await base.connect();
    },
    async disconnect() {
      await base.disconnect();
    },
    async close() {
      await base.disconnect();
    },
    async query(queryString: string, values: unknown[] = []) {
      // Convert positional '?' placeholders to $1, $2, ... for PostgreSQL
      let idx = 0;
      const converted = queryString.replace(/\?/g, () => `$${++idx}`);
      return base.query(converted, values);
    },
    async transaction(callback: (syncQuery?: unknown) => void | Promise<void>) {
      // Basic transaction wrapper — begin/commit/rollback
      await base.query('BEGIN', []);
      try {
        await callback();
        await base.query('COMMIT', []);
      } catch (err) {
        await base.query('ROLLBACK', []);
        throw err;
      }
    },
  };

  testDb = compat;
  // Store path for cleanup if a file-based DB was requested
  if (dbPath) {
    testDb.__testDbPath = dbPath;
  }

  await testDb.connect();

  return testDb;
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testDb) {
    try {
      await testDb.disconnect();
      const dbPath = testDb.__testDbPath;
      if (dbPath && fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    testDb = null;
  }
}

/**
 * Seed test data
 */
export async function seedTestData(
  db: DatabaseAdapter,
  tableName: string,
  data: Array<Record<string, unknown>>,
): Promise<void> {
  // Create table if it doesn't exist
  // Note: This is a simplified version - actual implementation would use RevealUI collections

  for (const item of data) {
    const columns = Object.keys(item).join(', ');
    const placeholders = Object.keys(item)
      .map(() => '?')
      .join(', ');
    const values = Object.values(item);

    await db.query(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values);
  }
}

/**
 * Cleanup test data
 */
export async function cleanupTestData(
  db: DatabaseAdapter,
  tableName: string,
  whereClause?: string,
  whereValues?: unknown[],
): Promise<void> {
  if (whereClause) {
    await db.query(`DELETE FROM ${tableName} WHERE ${whereClause}`, whereValues || []);
  } else {
    await db.query(`DELETE FROM ${tableName}`);
  }
}
