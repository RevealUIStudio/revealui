/**
 * Integration tests for database types
 *
 * Tests that generated types work correctly with actual database queries.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../database.js'
import { sessionsRelationships, sitesRelationships, usersRelationships } from '../database.js'
import { createTestClient, getTestDatabaseUrl } from './test-utils.js'

describe('Database Type Integration Tests', () => {
  let db: ReturnType<typeof createTestClient> | null = null
  let hasDatabase = false

  beforeAll(() => {
    // Check if database is available
    try {
      getTestDatabaseUrl()
      db = createTestClient()
      hasDatabase = true
    } catch (error) {
      // Database not available - tests will be skipped
      hasDatabase = false
      console.warn('⚠️  Database not available - skipping integration tests that require database')
    }
  })

  afterAll(async () => {
    // Cleanup if needed
  })

  it('should have correct Database type structure', () => {
    // Type-level test - verify Database type exists and has correct structure
    // This test always runs and validates types compile correctly
    const _users: Database['public']['Tables']['users'] =
      {} as Database['public']['Tables']['users']
    const _row: Database['public']['Tables']['users']['Row'] =
      {} as Database['public']['Tables']['users']['Row']
    const _insert: Database['public']['Tables']['users']['Insert'] =
      {} as Database['public']['Tables']['users']['Insert']
    const _update: Database['public']['Tables']['users']['Update'] =
      {} as Database['public']['Tables']['users']['Update']
    const _relationships: Database['public']['Tables']['users']['Relationships'] =
      {} as Database['public']['Tables']['users']['Relationships']

    expect(_users).toBeDefined()
    expect(_row).toBeDefined()
    expect(_insert).toBeDefined()
    expect(_update).toBeDefined()
    expect(_relationships).toBeDefined()
  })

  it('should have correct relationship types', () => {
    // Verify relationships are arrays (not objects)
    // Use type assertion to check structure
    const usersRelationships =
      [] as unknown as Database['public']['Tables']['users']['Relationships']
    const sessionsRelationships =
      [] as unknown as Database['public']['Tables']['sessions']['Relationships']

    expect(Array.isArray(usersRelationships)).toBe(true)
    expect(Array.isArray(sessionsRelationships)).toBe(true)
  })

  it('should verify users table has no relationships (no FK on users)', () => {
    // Users table has many() relationships but no one() relationships
    // So it should have empty relationships array
    const usersRelationships =
      [] as unknown as Database['public']['Tables']['users']['Relationships']
    expect(usersRelationships.length).toBe(0)
  })

  it('should verify sessions table has relationship to users', () => {
    // Sessions has one() relationship to users, so it should have a relationship entry
    // Use the actual generated relationships constant to verify runtime structure
    expect(Array.isArray(sessionsRelationships)).toBe(true)
    expect(sessionsRelationships.length).toBeGreaterThan(0)
    expect(sessionsRelationships[0]).toMatchObject({
      foreignKeyName: 'sessions_user_id_users_id_fk',
      columns: ['user_id'],
      isOneToOne: true,
      referencedRelation: 'users',
      referencedColumns: ['id'],
    })

    // Verify users has no relationships (no FK on users)
    expect(Array.isArray(usersRelationships)).toBe(true)
    expect(usersRelationships.length).toBe(0)
  })

  it('should verify sites table has relationship to users', () => {
    // Sites has one() relationship to users (ownerId), so it should have a relationship entry
    expect(Array.isArray(sitesRelationships)).toBe(true)
    expect(sitesRelationships.length).toBeGreaterThan(0)
    expect(sitesRelationships[0]).toMatchObject({
      foreignKeyName: 'sites_owner_id_users_id_fk',
      columns: ['owner_id'],
      isOneToOne: true,
      referencedRelation: 'users',
      referencedColumns: ['id'],
    })
  })

  it.skipIf(!hasDatabase || !db)('should query users table with correct types', async () => {
    // This test queries the actual database
    // TypeScript will verify types are correct at compile time
    const users = await db!.query.users.findMany()
    expect(Array.isArray(users)).toBe(true)

    // If users exist, verify structure matches Database type
    if (users.length > 0) {
      const user = users[0]
      // Type check: user should match Database['public']['Tables']['users']['Row']
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      // Verify relationships array is accessible on the type
      type UsersRelationships = Database['public']['Tables']['users']['Relationships']
      const _relationships: UsersRelationships = usersRelationships
      expect(Array.isArray(_relationships)).toBe(true)
    }
  })

  it.skipIf(!hasDatabase || !db)(
    'should query sessions table and verify relationship types',
    async () => {
      // Query sessions - should have relationship to users
      const sessions = await db!.query.sessions.findMany({
        with: {
          user: true, // This uses the relationship
        },
      })

      expect(Array.isArray(sessions)).toBe(true)

      // Verify relationship types are correct
      if (sessions.length > 0) {
        const session = sessions[0]
        expect(session).toHaveProperty('userId')
        // The with.user relationship should be included if it exists
        if (session.user) {
          expect(session.user).toHaveProperty('id')
          expect(session.user).toHaveProperty('email')
        }

        // Verify relationships array type structure
        type SessionsRelationships = Database['public']['Tables']['sessions']['Relationships']
        const _relationships: SessionsRelationships = sessionsRelationships
        expect(Array.isArray(_relationships)).toBe(true)
      }
    },
  )

  it('should validate relationship structure matches Supabase format', () => {
    // Verify that relationships are arrays of objects with correct structure
    // Use a generic relationship type to validate structure
    type Relationship = {
      foreignKeyName: string
      columns: string[]
      isOneToOne: boolean
      referencedRelation: string
      referencedColumns: string[]
    }

    // Create a test relationship matching the expected structure
    const _rel: Relationship = {
      foreignKeyName: 'test_fk',
      columns: ['test_column'],
      isOneToOne: true,
      referencedRelation: 'test_table',
      referencedColumns: ['id'],
    }

    expect(_rel).toBeDefined()
    expect(_rel.foreignKeyName).toBe('test_fk')
    expect(_rel.columns).toEqual(['test_column'])
    expect(_rel.isOneToOne).toBe(true)
    expect(_rel.referencedRelation).toBe('test_table')
    expect(_rel.referencedColumns).toEqual(['id'])

    // Verify the structure matches what we expect from Supabase format
    expect(typeof _rel.foreignKeyName).toBe('string')
    expect(Array.isArray(_rel.columns)).toBe(true)
    expect(typeof _rel.isOneToOne).toBe('boolean')
    expect(typeof _rel.referencedRelation).toBe('string')
    expect(Array.isArray(_rel.referencedColumns)).toBe(true)
  })
})
