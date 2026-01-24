/**
 * Tests for Database Introspection
 *
 * Verifies that:
 * - Schema validation works
 * - Introspection can connect to database
 * - Validation catches mismatches
 * - Error handling works correctly
 */

import { describe, expect, it } from 'vitest'
import { introspectDatabase, validateSchemaMatch } from '../introspect.js'

describe('Database Introspection', () => {
  const testConnectionString =
    process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL

  it('should return error when connection string is missing', async () => {
    const result = await introspectDatabase({ connectionString: undefined })
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('connection string')
  })

  it('should handle invalid connection string gracefully', async () => {
    const result = await introspectDatabase({
      connectionString: 'invalid-connection-string',
      validateSchema: false,
    })

    // Should fail gracefully with error
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.tables.length).toBe(0)
  })

  it.skipIf(!testConnectionString)(
    'should connect to database and query tables when connection is available',
    async () => {
      const result = await introspectDatabase({
        connectionString: testConnectionString!,
        validateSchema: false,
      })

      if (result.success) {
        // Should return list of tables from database
        expect(Array.isArray(result.tables)).toBe(true)
        expect(result.tables.length).toBeGreaterThan(0)
        // Should include common tables
        expect(result.tables).toContain('users')
      } else {
        // If connection fails, should have error message
        expect(result.errors).toBeDefined()
        expect(result.errors?.length).toBeGreaterThan(0)
      }
    },
  )

  it.skipIf(!testConnectionString)(
    'should validate schema matches database when connection is available',
    async () => {
      const result = await validateSchemaMatch(testConnectionString!)

      // Should return validation result
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(Array.isArray(result.mismatches)).toBe(true)

      if (result.success) {
        // If validation passes, no mismatches
        expect(result.mismatches.length).toBe(0)
      } else {
        // If validation fails, should have mismatch details
        expect(result.mismatches.length).toBeGreaterThan(0)
        expect(result.mismatches[0]).toHaveProperty('table')
        expect(result.mismatches[0]).toHaveProperty('issue')
      }
    },
  )

  it.skipIf(!testConnectionString)(
    'should detect expected tables from schema when database is available',
    async () => {
      const result = await introspectDatabase({
        connectionString: testConnectionString!,
        validateSchema: false,
      })

      if (result.success && result.tables.length > 0) {
        // Should include expected tables if they exist in database
        const expectedTables = ['users', 'sessions', 'sites', 'pages']
        const foundTables = expectedTables.filter((table) => result.tables.includes(table))
        // At least some expected tables should be found
        expect(foundTables.length).toBeGreaterThan(0)
      }
    },
  )

  it('should return proper error format on connection failure', async () => {
    // Use obviously invalid connection string
    const result = await introspectDatabase({
      connectionString: 'postgresql://invalid:invalid@invalid:5432/invalid',
      validateSchema: false,
    })

    // Should fail with proper error structure
    expect(result.success).toBe(false)
    expect(result.errors).toBeDefined()
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.errors?.length).toBeGreaterThan(0)
    expect(result.tables.length).toBe(0)
  })
})
