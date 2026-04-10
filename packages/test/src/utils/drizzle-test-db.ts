/**
 * PGlite + Drizzle ORM Integration Test Database
 *
 * Provides an in-memory PostgreSQL database for integration tests.
 * Uses @electric-sql/pglite for zero-setup, isolated test databases
 * with full PostgreSQL compatibility.
 *
 * Usage:
 *   import { createTestDb, type TestDb } from '@revealui/test/utils'
 *
 *   let db: TestDb
 *   beforeAll(async () => { db = await createTestDb() })
 *   afterAll(async () => { await db.close() })
 *
 *   it('queries users', async () => {
 *     await db.drizzle.insert(users).values({ ... })
 *     const rows = await db.drizzle.select().from(users)
 *   })
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import type * as schema from '@revealui/db/schema';
import type { PgliteDatabase } from 'drizzle-orm/pglite';

// =============================================================================
// Types
// =============================================================================

export interface TestDb {
  /** Typed Drizzle ORM client backed by PGlite */
  drizzle: PgliteDatabase<typeof schema>;
  /** Raw PGlite instance for direct SQL when needed */
  pglite: PGlite;
  /** Close the database and release resources */
  close(): Promise<void>;
}

export interface CreateTestDbOptions {
  /** Custom migration directory (default: auto-detected) */
  migrationsDir?: string;
  /** Enable query logging (default: false) */
  logger?: boolean;
}

// =============================================================================
// Migration loader
// =============================================================================

/**
 * Find the migrations directory relative to common locations.
 * Works from packages/test, apps/api, apps/admin, etc.
 */
function findMigrationsDir(): string {
  // Walk up from this file to find the monorepo root, then into packages/db/migrations
  // This file is at packages/test/src/utils/drizzle-test-db.ts
  // Monorepo root is 4 levels up
  return resolve(import.meta.dirname, '..', '..', '..', '..', 'packages', 'db', 'migrations');
}

/**
 * Read and parse all migration SQL files in order.
 * Drizzle-kit migrations use `--> statement-breakpoint` as separator.
 */
async function loadMigrations(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(dir);
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

  const statements: string[] = [];
  for (const file of sqlFiles) {
    const content = await readFile(resolve(dir, file), 'utf-8');
    for (const stmt of content.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) statements.push(trimmed);
    }
  }

  return statements;
}

// =============================================================================
// Database factory
// =============================================================================

/**
 * Create an in-memory PGlite database with all RevealUI schemas applied.
 *
 * Each call creates a fresh, isolated database — no shared state between tests.
 * The returned `drizzle` client is fully typed against `@revealui/db/schema`.
 */
export async function createTestDb(options?: CreateTestDbOptions): Promise<TestDb> {
  // Dynamic imports — PGlite and drizzle-orm/pglite are devDependencies
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dbSchema = await import('@revealui/db/schema');

  // Create in-memory PGlite instance
  const pglite = new PGlite();

  // Apply all migrations
  const migrationsDir = options?.migrationsDir ?? findMigrationsDir();
  const statements = await loadMigrations(migrationsDir);

  // Tables that use vector columns — PGlite doesn't support pgvector
  const vectorTables = new Set<string>();

  for (const stmt of statements) {
    const lower = stmt.toLowerCase();

    // Skip CREATE EXTENSION for vector
    if (lower.includes('create extension') && lower.includes('vector')) continue;

    // Detect and skip tables that use vector columns
    if (lower.includes('vector(') && lower.includes('create table')) {
      // Extract table name: CREATE TABLE "table_name" (
      const tableMatch = stmt.match(/create\s+table\s+"([^"]+)"/i);
      if (tableMatch) vectorTables.add(tableMatch[1]);
      continue;
    }

    // Skip statements referencing vector tables
    if (vectorTables.size > 0) {
      const refsVectorTable = [...vectorTables].some(
        (t) => lower.includes(`"${t}"`) || lower.includes(`"${t}".`),
      );
      if (refsVectorTable) continue;
    }

    try {
      await pglite.exec(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Skip errors from unsupported extensions or vector types
      if (msg.includes('extension') || msg.includes('EXTENSION')) continue;
      if (msg.includes('"vector"') || msg.includes('type "vector"')) continue;
      if (msg.includes('does not exist')) continue;
      if (msg.includes('already exists')) continue;
      // CONCURRENTLY — retry without it
      if (msg.includes('CONCURRENTLY')) {
        const fixed = stmt.replace(/\bCONCURRENTLY\b/gi, '');
        try {
          await pglite.exec(fixed);
        } catch {
          // Skip if still fails
        }
        continue;
      }
      throw err;
    }
  }

  // Create typed Drizzle client
  const db = drizzle({
    client: pglite,
    schema: dbSchema,
    logger: options?.logger ?? false,
  });

  return {
    drizzle: db as PgliteDatabase<typeof schema>,
    pglite,
    async close() {
      await pglite.close();
    },
  };
}

// =============================================================================
// Seed helpers
// =============================================================================

/**
 * Seed a test user into the database. Returns the inserted user row.
 */
export async function seedTestUser(
  db: PgliteDatabase<typeof schema>,
  overrides?: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    stripeCustomerId: string;
  }>,
): Promise<{ id: string; email: string; name: string }> {
  const { randomUUID } = await import('node:crypto');
  const { users } = await import('@revealui/db/schema');

  const id = overrides?.id ?? randomUUID();
  const email = overrides?.email ?? `test-${id}@example.com`;
  const name = overrides?.name ?? 'Test User';

  await db.insert(users).values({
    id,
    name,
    email,
    role: overrides?.role ?? 'viewer',
    status: overrides?.status ?? 'active',
    stripeCustomerId: overrides?.stripeCustomerId,
  });

  return { id, email, name };
}

/**
 * Clean all rows from the specified tables (in order, respecting FK constraints).
 */
export async function cleanTables(
  db: PgliteDatabase<typeof schema>,
  tableNames: string[],
): Promise<void> {
  const { sql } = await import('drizzle-orm');
  for (const table of tableNames) {
    await db.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}
