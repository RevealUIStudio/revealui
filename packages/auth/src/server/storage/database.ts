/**
 * Database Storage
 *
 * Database backend using Drizzle ORM
 * Slower than Redis but uses existing database infrastructure
 */

// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
import configModule from '@revealui/config'
import { createClient, type Database } from '@revealui/db/client'
import { and, eq, gte, rateLimits } from '@revealui/db/schema'
import type { Storage } from './interface.js'

export class DatabaseStorage implements Storage {
  private db: Database

  constructor(connectionString?: string) {
    // Use centralized config, but allow override for testing
    // Type assertion needed because config is a Proxy and TypeScript may not infer types correctly
    const config = configModule as { database: { url: string } }
    const url =
      connectionString ||
      config.database?.url ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      ''

    if (!url) {
      throw new Error('Database connection string required for DatabaseStorage')
    }

    this.db = createClient({ connectionString: url })
  }

  async get(key: string): Promise<string | null> {
    // Filter expired entries at database level
    const now = new Date()
    const result = await this.db.query.rateLimits.findFirst({
      where: and(eq(rateLimits.key, key), gte(rateLimits.resetAt, now)),
    })

    if (!result) {
      return null
    }

    return result.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const resetAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours

    await this.db
      .insert(rateLimits)
      .values({
        key,
        value,
        resetAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          value,
          resetAt,
          updatedAt: new Date(),
        },
      })
  }

  async del(key: string): Promise<void> {
    await this.db.delete(rateLimits).where(eq(rateLimits.key, key))
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key)
    const newValue = current ? parseInt(current, 10) + 1 : 1
    await this.set(key, String(newValue))
    return newValue
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.get(key)
    return result !== null
  }

  /**
   * Atomically read and update a value using a database transaction.
   * Falls back to non-atomic get-then-set if transactions are unavailable
   * (e.g., Neon HTTP mode in environments that don't support advisory locks).
   */
  async atomicUpdate(
    key: string,
    updater: (existing: string | null) => { value: string; ttlSeconds: number },
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const now = new Date()
        const result = await tx.query.rateLimits.findFirst({
          where: and(eq(rateLimits.key, key), gte(rateLimits.resetAt, now)),
        })
        const { value, ttlSeconds } = updater(result?.value ?? null)
        const resetAt = new Date(Date.now() + ttlSeconds * 1000)
        await tx
          .insert(rateLimits)
          .values({ key, value, resetAt })
          .onConflictDoUpdate({
            target: rateLimits.key,
            set: { value, resetAt, updatedAt: new Date() },
          })
      })
    } catch (error) {
      // Only fall back for transaction-not-supported errors (e.g., Neon HTTP serverless).
      // Re-throw real DB errors (connection failures, constraint violations, deadlocks).
      const msg = error instanceof Error ? error.message : String(error)
      if (!(msg.includes('transaction') || msg.includes('Transaction'))) {
        throw error
      }
      const existing = await this.get(key)
      const { value, ttlSeconds } = updater(existing)
      await this.set(key, value, ttlSeconds)
    }
  }
}
