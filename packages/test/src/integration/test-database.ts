/**
 * Test Database Utilities
 *
 * Shared utilities for test database setup, seeding, and cleanup.
 * Used across integration tests in all packages.
 */

import { createClient, type Database } from '@revealui/db/client';
import { agentMemories, nodeIdMappings, sessions, users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get test database connection string
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Test database URL not found. Set POSTGRES_URL or DATABASE_URL environment variable.',
    );
  }

  return url;
}

/**
 * Create a test database client
 */
export function createTestDatabase(): Database {
  const connectionString = getTestDatabaseUrl();
  return createClient({ connectionString });
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  db: Database,
  options?: { userIds?: string[] },
): Promise<void> {
  const userIds = options?.userIds || [];

  // Clean up in reverse dependency order
  if (userIds.length > 0) {
    // Delete sessions
    for (const userId of userIds) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }

    // Delete agent memories
    for (const userId of userIds) {
      await db.delete(agentMemories).where(eq(agentMemories.userId, userId));
    }

    // Delete node ID mappings
    for (const userId of userIds) {
      await db.delete(nodeIdMappings).where(eq(nodeIdMappings.entityId, userId));
    }

    // Delete users
    for (const userId of userIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }
}

/**
 * Seed test data
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  name?: string;
}

/**
 * Create a test user
 */
export async function createTestUser(
  db: Database,
  user: TestUser,
): Promise<{ id: string; email: string }> {
  const [created] = await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
      // Password should be hashed in real implementation
      // For tests, we might use a test-specific approach
      name: user.name || 'Test User',
    })
    .returning({ id: users.id, email: users.email });

  if (!created) {
    throw new Error('Failed to create test user');
  }

  return created;
}

/**
 * Run migrations on test database
 */
export function runMigrations(db: Database): Promise<void> {
  // Migrations are typically run via drizzle-kit or migration scripts
  // This is a placeholder for programmatic migration execution
  // In practice, migrations should be run before tests via setup scripts
  void db;
  return Promise.resolve();
}

/**
 * Check if database is accessible
 */
export async function checkDatabaseConnection(db: Database): Promise<boolean> {
  try {
    // Simple query to check connection
    await db.query.users.findFirst({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(
  db: Database,
  timeout = 30000,
  interval = 1000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await checkDatabaseConnection(db)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Database not ready within timeout');
}

/**
 * Reset test database (drop and recreate tables)
 * WARNING: This is destructive and should only be used in test environments
 */
export function resetTestDatabase(db: Database): Promise<void> {
  // This would typically use drizzle-kit or raw SQL
  // For safety, we'll just clean up test data instead
  // Full reset should be done via migration scripts
  void db;
  return Promise.reject(
    new Error(
      'resetTestDatabase is not implemented. Use cleanupTestData() or run migrations instead.',
    ),
  );
}

/**
 * Test database configuration
 */
export interface TestDatabaseConfig {
  connectionString: string;
  cleanupAfterTests?: boolean;
  seedData?: boolean;
}

/**
 * Setup test database with configuration
 */
export async function setupTestDatabase(
  config: TestDatabaseConfig,
): Promise<{ db: Database; cleanup: () => Promise<void> }> {
  const db = createClient({ connectionString: config.connectionString });

  // Wait for database to be ready
  await waitForDatabase(db);

  // Run migrations if needed
  if (config.seedData) {
    await runMigrations(db);
  }

  const cleanup = (): Promise<void> => {
    if (config.cleanupAfterTests) {
      // Cleanup would go here
      // For now, just close connection
    }
    return Promise.resolve();
  };

  return { db, cleanup };
}
