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

import config from '@revealui/config';
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

  // Priority: Database > In-Memory
  // Try config first (may throw ConfigValidationError if unrelated env vars are missing),
  // then fall back to process.env so Vercel deployments with a valid DATABASE_URL
  // don't silently degrade to per-instance InMemoryStorage.
  let dbUrl: string | undefined;
  try {
    const configUrl = config?.database?.url;
    if (typeof configUrl === 'string' && configUrl) {
      dbUrl = configUrl;
    }
  } catch {
    // Config validation failed  -  try process.env fallback below
  }
  dbUrl = dbUrl || process.env.POSTGRES_URL || process.env.DATABASE_URL;

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
  // Use centralized config for database URL
  try {
    if (config?.database?.url) {
      try {
        return new DatabaseStorage();
      } catch {
        // Fall through to in-memory
      }
    }
  } catch {
    // Config validation failed  -  fall through to in-memory
  }

  return new InMemoryStorage();
}

/**
 * Reset global storage (for testing)
 */
export function resetStorage(): void {
  globalStorage = null;
}

export { DatabaseStorage } from './database.js';
// Export storage implementations
export { InMemoryStorage } from './in-memory.js';
export type { Storage } from './interface.js';
