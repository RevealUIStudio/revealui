/**
 * Test database utilities
 *
 * Provides utilities for test database setup, teardown, seeding, and cleanup
 */

import fs from 'node:fs';
import { universalPostgresAdapter } from '@revealui/core';
import type { DatabaseAdapter, QueryableDatabaseAdapter } from '@revealui/core/types';

type TestDatabaseAdapter = DatabaseAdapter & {
  __testDbPath?: string;
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
    async transaction<T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>): Promise<T> {
      // Delegate to the real adapter's transaction so the callback runs on
      // a single held connection (required for read-after-write correctness).
      // The `?` → `$n` placeholder conversion is applied inside the tx wrapper.
      if (!base.transaction) {
        throw new Error('Underlying test adapter does not support transactions');
      }
      return await base.transaction(async (baseTx) => {
        const tx: QueryableDatabaseAdapter = {
          query: async (queryString: string, values: unknown[] = []) => {
            let idx = 0;
            const converted = queryString.replace(/\?/g, () => `$${++idx}`);
            return baseTx.query(converted, values);
          },
        };
        return await fn(tx);
      });
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
