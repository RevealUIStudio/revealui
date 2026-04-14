/**
 * Integration test helpers
 *
 * Utilities for setting up and managing integration test environments
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CollectionConfig } from '@revealui/contracts/admin';
import type { RevealUIInstance } from '@revealui/core';
import { buildConfig, getRevealUI, universalPostgresAdapter } from '@revealui/core';
import type { DatabaseAdapter, RevealDataObject } from '@revealui/core/types';

type SqlitePragmaRow = { name?: string; file?: string };
type TestDatabaseAdapter = DatabaseAdapter & {
  __testDbPath?: string;
  __db?: {
    pragma?: (command: string) => SqlitePragmaRow[];
  };
};

function getTestDbPath(adapter?: DatabaseAdapter | null): string | undefined {
  return (adapter as TestDatabaseAdapter | null)?.__testDbPath;
}

let testDatabase: TestDatabaseAdapter | null = null;
let testRevealUI: RevealUIInstance | null = null;
const testDataTrackers: Array<{ collection: string; id: string }> = [];

// Store database file path to verify all instances use the same file
let testDatabasePath: string | null = null;

// Mutex to prevent concurrent database creation
let databaseCreationPromise: Promise<TestDatabaseAdapter> | null = null;

/**
 * Setup a test database for integration tests
 *
 * This function ensures a singleton database adapter instance is used across all tests.
 * All tests should use the same database instance to ensure data persistence.
 */
export async function setupTestDatabase(): Promise<TestDatabaseAdapter> {
  // If database already exists, return it immediately
  if (testDatabase) {
    // Verify we're returning the same instance
    const currentPath = testDatabase.__testDbPath;
    if (currentPath && testDatabasePath && currentPath !== testDatabasePath) {
      throw new Error(
        `Database path mismatch! Expected: ${testDatabasePath}, Got: ${currentPath}. ` +
          'This indicates multiple database instances are being created.',
      );
    }
    return testDatabase;
  }

  // If creation is in progress, wait for it
  if (databaseCreationPromise) {
    return databaseCreationPromise;
  }

  // Start creation (only one at a time)
  // CRITICAL: Don't clear databaseCreationPromise until ALL awaiters have resolved
  // Store it in a variable first to ensure it's not lost
  databaseCreationPromise = (async () => {
    // Double-check after acquiring the lock (another caller might have created it)
    if (testDatabase) {
      return testDatabase;
    }

    // Create temporary database file
    // Use a consistent path across all test runs for the same session
    const tmpDir = os.tmpdir();
    // Use a fixed filename to ensure consistency (don't use Date.now() which changes)
    // For parallel workers, we need a shared path - use a fixed name for all workers
    // This ensures all test workers in the same run use the same database
    const dbPath = testDatabasePath || path.join(tmpDir, `revealui-test-shared-pglite`);

    // Store the path before creating the adapter
    if (!testDatabasePath) {
      testDatabasePath = dbPath;
    }

    // Use electric/pglite universal adapter for integration tests (local Postgres-compatible)
    testDatabase = universalPostgresAdapter({
      provider: 'electric',
    }) as unknown as TestDatabaseAdapter;

    await testDatabase.connect();

    // Store cleanup path reference for compatibility
    testDatabase.__testDbPath = dbPath;

    process.stdout.write(
      `[TEST DB] Created test database adapter (electric/pglite) at: ${dbPath} (PID: ${process.pid})\n`,
    );

    return testDatabase;
  })();

  // Wait for creation to complete, then clear the promise
  // This ensures all concurrent callers wait for the same promise
  const result = await databaseCreationPromise;
  databaseCreationPromise = null;

  return result;
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testDatabase) {
    try {
      await testDatabase.disconnect();
      const dbPath = testDatabase.__testDbPath;
      if (dbPath && fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    testDatabase = null;
  }
}

/**
 * Create a test RevealUI instance
 */
export async function createTestAPI(): Promise<RevealUIInstance> {
  if (testRevealUI) {
    // Verify the RevealUI instance is using the same database adapter
    const revealuiDbPath =
      getTestDbPath(testRevealUI.db as DatabaseAdapter) ||
      getTestDbPath(testRevealUI.config?.db as DatabaseAdapter | undefined);
    if (revealuiDbPath && testDatabasePath && revealuiDbPath !== testDatabasePath) {
      throw new Error(
        `RevealUI instance database path mismatch! Expected: ${testDatabasePath}, Got: ${revealuiDbPath}. ` +
          'This indicates the RevealUI instance is using a different database adapter.',
      );
    }
    return testRevealUI;
  }

  // Ensure test database is set up
  const testDatabase = await setupTestDatabase();

  // Verify we got the same instance
  const dbPath = testDatabase.__testDbPath;
  if (dbPath !== testDatabasePath) {
    throw new Error(
      `Database adapter path mismatch in createTestAPI! Expected: ${testDatabasePath}, Got: ${dbPath}. ` +
        'This indicates setupTestDatabase returned a different instance.',
    );
  }

  // Create minimal test config with users collection for integration tests
  const testUsersCollection: CollectionConfig = {
    slug: 'users',
    timestamps: true,
    admin: {
      useAsTitle: 'email',
    },
    auth: {
      useAPIKey: true,
    },
    access: {
      create: () => true, // Allow creation in tests
      read: () => true,
      update: () => true,
      delete: () => true,
    },
    fields: [
      {
        name: 'email',
        type: 'email',
        required: true,
        unique: true,
      },
      {
        name: 'password',
        type: 'text',
        required: true,
      },
      {
        name: 'firstName',
        type: 'text',
      },
      {
        name: 'lastName',
        type: 'text',
      },
      {
        name: 'roles',
        type: 'select',
        hasMany: true,
        options: [
          { label: 'Super Admin', value: 'super-admin' },
          { label: 'Admin', value: 'admin' },
        ],
      },
      {
        name: 'tenants',
        type: 'array',
      },
    ],
  };

  const testConfig = buildConfig({
    secret: process.env.REVEALUI_SECRET || 'test-secret-key-change-in-production',
    serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:3000',
    collections: [testUsersCollection],
    globals: [],
    admin: {
      importMap: {
        autoGenerate: true,
      },
    },
    typescript: {
      autoGenerate: false,
    },
    localization: {
      locales: ['en'],
      defaultLocale: 'en',
      fallback: true,
    },
    db: testDatabase, // RevealConfig expects db directly, not database.adapter
  });

  testRevealUI = await getRevealUI({ config: testConfig });

  return testRevealUI;
}

/**
 * Cleanup test API instance
 */
export function cleanupTestAPI(): void {
  testRevealUI = null;
}

/**
 * Cleanup test data created during tests
 */
export async function cleanupTestData(): Promise<void> {
  if (!testRevealUI) {
    return;
  }

  // Delete tracked test data in reverse order
  for (const tracker of testDataTrackers.reverse()) {
    try {
      await testRevealUI.delete({
        collection: tracker.collection,
        id: tracker.id,
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  testDataTrackers.length = 0;
}

/**
 * Track test data for cleanup
 */
export function trackTestData(collection: string, id: string): void {
  testDataTrackers.push({ collection, id });
}

/**
 * Seed test data into database
 */
export async function seedTestData(data: {
  collection: string;
  items: Array<RevealDataObject>;
}): Promise<Array<{ id: string }>> {
  const revealui = await createTestAPI();
  const created: Array<{ id: string }> = [];

  for (const item of data.items) {
    const result = await revealui.create({
      collection: data.collection,
      data: item,
    });
    created.push({ id: String(result.id) });
    trackTestData(data.collection, String(result.id));
  }

  return created;
}

/**
 * Get or create RevealUI instance (reused across tests)
 */
export async function getTestRevealUI(): Promise<RevealUIInstance> {
  return createTestAPI();
}

/**
 * Reset all test state
 */
export async function resetTestState(): Promise<void> {
  await cleanupTestData();
  cleanupTestAPI();
  await teardownTestDatabase();
}

/**
 * Generate a unique test email address
 * Uses UUID to ensure uniqueness even in parallel test execution
 *
 * @param prefix - Optional prefix for the email (default: 'test')
 * @returns A unique email address in the format: {prefix}-{uuid}@example.com
 *
 * @example
 * ```typescript
 * const email = generateUniqueTestEmail('user')
 * // Returns: 'user-550e8400-e29b-41d4-a716-446655440000@example.com'
 * ```
 */
export function generateUniqueTestEmail(prefix = 'test'): string {
  const uuid = randomUUID();
  return `${prefix}-${uuid}@example.com`;
}
