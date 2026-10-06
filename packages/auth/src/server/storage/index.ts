/**
 * Storage Factory
 *
 * Selects storage backend based on configuration.
 * Priority: Database > In-Memory
 *
 * Architecture Decision (2026-03-11):
 * Production deployments use DatabaseStorage backed by NeonDB (PostgreSQL).
 * Neon's serverless driver uses HTTP (not persistent connections), so each
 * rate limit check is a single HTTP round-trip (~30-50ms). State persists
 * across Vercel cold starts because it lives in PostgreSQL, not process memory.
 * This is acceptable for current scale. If sub-10ms latency becomes critical,
 * add an ElectricSQL/PGlite adapter implementing the Storage interface.
 *
 * In-memory storage is ONLY used in development (throws in production if
 * DATABASE_URL is missing).
 */

import { resolveDatabaseUrl } from '@revealui/config/database-url';
import { logger } from '@revealui/core/observability/logger';
import { DatabaseStorage } from './database.js';
import { InMemoryStorage } from './in-memory.js';
import type { Storage } from './interface.js';

let globalStorage: Storage | null = null;

/**
 * Get or create storage instance
 */
export function getStorage(): Storage {
  if (globalStorage) {
    return globalStorage;
  }

  // One URL for the process. A production conflict throws here and must not
  // fall through to in-memory storage.
  const dbUrl = resolveDatabaseUrl();

  if (dbUrl) {
    try {
      globalStorage = new DatabaseStorage(dbUrl);
      return globalStorage;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Rate limiting requires database storage in production. DatabaseStorage failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      logger.warn('Failed to create DatabaseStorage, falling back to InMemoryStorage', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Rate limiting requires DATABASE_URL or POSTGRES_URL in production. In-memory storage is not safe for distributed deployments.',
    );
  }

  // Fallback to in-memory (development only)
  globalStorage = new InMemoryStorage();
  return globalStorage;
}

/**
 * Create a new storage instance (for testing)
 */
export function createStorage(): Storage {
  try {
    const url = resolveDatabaseUrl();
    if (url) {
      return new DatabaseStorage(url);
    }
  } catch (error) {
    // Production conflict must not degrade to per-process memory.
    if (process.env.NODE_ENV === 'production') throw error;
  }

  return new InMemoryStorage();
}

/**
 * Reset global storage (for testing)
 */
export function resetStorage(): void {
  globalStorage = null;
}

/**
 * Override the global storage instance (for testing).
 *
 * Lets a test pin a specific backend — e.g. {@link InMemoryStorage} — so the
 * rate-limit/brute-force logic runs against in-process state instead of the
 * shared `DatabaseStorage` singleton. The DB-backed integration suite runs
 * single-threaded with `isolate: false`, so a shared Postgres-backed store
 * under contention can intermittently drop a write (manifesting as e.g. "not
 * locked after 5 attempts"); pinning InMemoryStorage removes that I/O entirely.
 * Pair with {@link resetStorage} in teardown so later code re-derives the real
 * backend.
 */
export function setStorage(storage: Storage): void {
  globalStorage = storage;
}

export { DatabaseStorage } from './database.js';
// Export storage implementations
export { InMemoryStorage } from './in-memory.js';
export type { Storage } from './interface.js';
