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
  // Try config first (may throw ConfigValidationError if unrelated env vars are missing),
  // then fall back to process.env so Vercel deployments with a valid DATABASE_URL
  // don't silently degrade to per-instance InMemoryStorage.
  let dbUrl: string | undefined
  try {
    const configUrl = config?.database?.url
    if (typeof configUrl === 'string' && configUrl) {
      dbUrl = configUrl
    }
  } catch {
    // Config validation failed — try process.env fallback below
  }
  dbUrl = dbUrl || process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (dbUrl) {
    try {
      globalStorage = new DatabaseStorage(dbUrl)
      return globalStorage
    } catch (error) {
      logger.warn('Failed to create DatabaseStorage, falling back to InMemoryStorage', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Fallback to in-memory (development without DATABASE_URL)
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
