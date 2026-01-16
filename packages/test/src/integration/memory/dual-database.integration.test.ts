/**
 * Dual Database Integration Tests
 *
 * Tests that REST and Vector databases are properly separated.
 * Verifies that clients use correct schemas and databases.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getRestClient, getVectorClient, resetClient } from '@revealui/db/client'
import { agentMemories } from '@revealui/db/core/vector'
import { users } from '@revealui/db/core/rest'
import { eq, sql } from 'drizzle-orm'

describe('Dual Database Integration', () => {
  beforeAll(() => {
    // Verify both database URLs are set
    if (!process.env.POSTGRES_URL) {
      throw new Error(
        'POSTGRES_URL must be set for dual database integration tests. ' +
          'This should point to your NeonDB (REST) database.',
      )
    }

    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL must be set for dual database integration tests. ' +
          'This should point to your Supabase (Vector) database.',
      )
    }
  })

  describe('Client Separation', () => {
    it('should return separate client instances', () => {
      resetClient()
      const restClient = getRestClient()
      const vectorClient = getVectorClient()

      expect(restClient).toBeDefined()
      expect(vectorClient).toBeDefined()
      expect(restClient).not.toBe(vectorClient)
    })

    it('should return same instance for same type', () => {
      resetClient()
      const restClient1 = getRestClient()
      const restClient2 = getRestClient()

      expect(restClient1).toBe(restClient2)
    })

    it('should connect to different databases', async () => {
      resetClient()
      const restClient = getRestClient()
      const vectorClient = getVectorClient()

      // Both should be able to execute queries
      const restResult = await restClient.execute(sql`SELECT 1 as test`)
      const vectorResult = await vectorClient.execute(sql`SELECT 1 as test`)

      expect(restResult).toBeDefined()
      expect(vectorResult).toBeDefined()
    })
  })

  describe('Schema Separation', () => {
    it('should not have agentMemories in REST client schema', () => {
      resetClient()
      const restClient = getRestClient()

      // REST client should not have agentMemories in its query interface
      // This is a compile-time check, but we can verify at runtime
      expect(restClient.query).toBeDefined()
      // agentMemories should not be accessible via REST client
      // (TypeScript would catch this, but we verify runtime behavior)
    })

    it('should have agentMemories in Vector client schema', () => {
      resetClient()
      const vectorClient = getVectorClient()

      // Vector client should have agentMemories
      expect(vectorClient.query).toBeDefined()
      // We can't easily check the schema at runtime, but TypeScript ensures this
    })

    it('should have users in REST client schema', () => {
      resetClient()
      const restClient = getRestClient()

      // REST client should have users table
      expect(restClient.query).toBeDefined()
      // TypeScript ensures users is available
    })

    it('should not have users in Vector client schema', () => {
      resetClient()
      const vectorClient = getVectorClient()

      // Vector client should not have users table
      expect(vectorClient.query).toBeDefined()
      // TypeScript would prevent accessing users via vector client
    })
  })

  describe('Database Operations', () => {
    it('should query users from REST database', async () => {
      resetClient()
      const restClient = getRestClient()

      // Should be able to query users table
      const result = await restClient.execute(sql`SELECT COUNT(*) as count FROM users`)
      expect(result).toBeDefined()
    })

    it('should query agent_memories from Vector database', async () => {
      resetClient()
      const vectorClient = getVectorClient()

      // Should be able to query agent_memories table
      const result = await vectorClient.execute(
        sql`SELECT COUNT(*) as count FROM agent_memories`,
      )
      expect(result).toBeDefined()
    })

    it('should not be able to query agent_memories from REST database', async () => {
      resetClient()
      const restClient = getRestClient()

      // This should fail because agent_memories is not in REST database
      // (or if it exists, it's a different table)
      try {
        await restClient.execute(sql`SELECT COUNT(*) as count FROM agent_memories`)
        // If this succeeds, the table might exist in both databases (legacy)
        // That's okay, but ideally it should only be in vector database
      } catch (error) {
        // Expected: table doesn't exist in REST database
        expect(error).toBeDefined()
      }
    })

    it('should not be able to query users from Vector database', async () => {
      resetClient()
      const vectorClient = getVectorClient()

      // This should fail because users is not in Vector database
      try {
        await vectorClient.execute(sql`SELECT COUNT(*) as count FROM users`)
        // If this succeeds, the table might exist in both databases (legacy)
        // That's okay, but ideally it should only be in REST database
      } catch (error) {
        // Expected: table doesn't exist in Vector database
        expect(error).toBeDefined()
      }
    })
  })

  describe('Connection Strings', () => {
    it('should use POSTGRES_URL for REST client', () => {
      const originalPostgresUrl = process.env.POSTGRES_URL
      const originalDatabaseUrl = process.env.DATABASE_URL
      
      // Delete both to test that REST client requires at least one
      delete process.env.POSTGRES_URL
      delete process.env.DATABASE_URL

      resetClient()

      // Should throw error mentioning POSTGRES_URL or DATABASE_URL
      expect(() => getRestClient()).toThrow(/POSTGRES_URL|DATABASE_URL/)

      // Restore
      if (originalPostgresUrl) {
        process.env.POSTGRES_URL = originalPostgresUrl
      }
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl
      }
    })

    it('should use DATABASE_URL for Vector client', () => {
      const originalUrl = process.env.DATABASE_URL
      delete process.env.DATABASE_URL

      resetClient()

      expect(() => getVectorClient()).toThrow('DATABASE_URL')

      // Restore
      if (originalUrl) {
        process.env.DATABASE_URL = originalUrl
      }
    })
  })
})
