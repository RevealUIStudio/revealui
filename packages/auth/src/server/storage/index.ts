/**
 * Storage Factory
 *
 * Selects storage backend based on configuration
 * Priority: Database > In-Memory
 *
 * Note: Uses database storage for distributed rate limiting (works with ElectricSQL sync).
 * ElectricSQL handles client-side sync, database handles server-side storage.
 */

import config from '@revealui/config'
import { logger } from '@revealui/core/observability/logger'
import { DatabaseStorage } from './database.js'
import { InMemoryStorage } from './in-memory.js'
import type { Storage } from './interface.js'

let globalStorage: Storage | null = null

/**
 * Get or create storage instance
 */
export function getStorage(): Storage {
  if (globalStorage) {
    return globalStorage
  }

  // Priority: Database > In-Memory
  // Use centralized config for database URL
  // Wrap config access in try/catch — the @revealui/config Proxy triggers
  // validateAndThrow() which throws ConfigValidationError when env vars are
  // missing. Without this guard the error propagates to an unhandled 500.
  try {
    if (config?.database?.url) {
      try {
        globalStorage = new DatabaseStorage()
        return globalStorage
      } catch (error) {
        logger.warn('Failed to create DatabaseStorage, falling back to InMemoryStorage', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } catch (error) {
    logger.warn('Config validation failed, falling back to InMemoryStorage', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Fallback to in-memory (development only)
  globalStorage = new InMemoryStorage()
  return globalStorage
}

/**
 * Create a new storage instance (for testing)
 */
export function createStorage(): Storage {
  // Use centralized config for database URL
  try {
    if (config?.database?.url) {
      try {
        return new DatabaseStorage()
      } catch {
        // Fall through to in-memory
      }
    }
  } catch {
    // Config validation failed — fall through to in-memory
  }

  return new InMemoryStorage()
}

/**
 * Reset global storage (for testing)
 */
export function resetStorage(): void {
  globalStorage = null
}

export { DatabaseStorage } from './database.js'
// Export storage implementations
export { InMemoryStorage } from './in-memory.js'
export type { Storage } from './interface.js'
