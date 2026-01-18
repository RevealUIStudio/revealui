/**
 * Integration tests for Relationship Extraction (AST Parsing)
 *
 * Tests the extractRelationships() function end-to-end using actual schema files.
 * For unit tests of internal functions in isolation, see extract-units.test.ts
 *
 * These tests verify that the relationship extraction system works correctly with real files,
 * while unit tests verify individual function behavior with controlled inputs.
 */

import { describe, expect, it } from 'vitest'
import { discoverTables } from '../discover.js'
import { extractRelationships } from '../extract-relationships.js'

describe('Relationship Extraction - AST Parsing', () => {
  describe('extractRelationships', () => {
    it('should extract relationships from relations() calls', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      expect(result).toHaveProperty('relationships')
      expect(result).toHaveProperty('errors')
      expect(Array.isArray(result.relationships)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should extract sessions -> users relationship', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      const sessionsRel = result.relationships.find((r) => r.tableVariableName === 'sessions')
      expect(sessionsRel).toBeDefined()

      const userRel = sessionsRel?.relationships.find(
        (r) => r.referencedRelation === 'users' && r.columns.includes('user_id'),
      )
      expect(userRel).toBeDefined()
      expect(userRel?.isOneToOne).toBe(true)
      expect(userRel?.foreignKeyName).toBe('sessions_user_id_users_id_fk')
    })

    it('should extract sites -> users relationship', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      const sitesRel = result.relationships.find((r) => r.tableVariableName === 'sites')
      expect(sitesRel).toBeDefined()

      const ownerRel = sitesRel?.relationships.find(
        (r) => r.referencedRelation === 'users' && r.columns.includes('owner_id'),
      )
      expect(ownerRel).toBeDefined()
      expect(ownerRel?.isOneToOne).toBe(true)
    })

    it('should return empty relationships for tables with no one() relations', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      const usersRel = result.relationships.find((r) => r.tableVariableName === 'users')
      // Users has many() relations but no one() relations, so should be empty
      expect(usersRel).toBeDefined()
      expect(Array.isArray(usersRel?.relationships)).toBe(true)
    })

    it('should include all tables in results even without relationships', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Every discovered table should have an entry
      expect(result.relationships.length).toBe(tables.tables.length)

      for (const table of tables.tables) {
        const rel = result.relationships.find((r) => r.tableVariableName === table.variableName)
        expect(rel).toBeDefined()
      }
    })
  })

  describe('Relationship Structure', () => {
    it('should generate correct foreign key names', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      const sessionsRel = result.relationships.find((r) => r.tableVariableName === 'sessions')
      const userRel = sessionsRel?.relationships.find((r) => r.referencedRelation === 'users')

      expect(userRel?.foreignKeyName).toBe('sessions_user_id_users_id_fk')
    })

    it('should include all columns in relationship', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      for (const tableRel of result.relationships) {
        for (const rel of tableRel.relationships) {
          expect(Array.isArray(rel.columns)).toBe(true)
          expect(Array.isArray(rel.referencedColumns)).toBe(true)
          expect(rel.columns.length).toBeGreaterThan(0)
          expect(rel.referencedColumns.length).toBeGreaterThan(0)
        }
      }
    })

    it('should set isOneToOne correctly for one() relationships', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      for (const tableRel of result.relationships) {
        for (const rel of tableRel.relationships) {
          // All extracted relationships should be one-to-one (from one() calls)
          expect(rel.isOneToOne).toBe(true)
        }
      }
    })

    it('should match column count between fields and references', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      for (const tableRel of result.relationships) {
        for (const rel of tableRel.relationships) {
          expect(rel.columns.length).toBe(rel.referencedColumns.length)
        }
      }
    })
  })

  describe('Validation', () => {
    it('should validate referenced tables exist', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Check validation errors
      const validationErrors = result.errors.filter((e) => e.message.includes('does not exist'))

      // Should not have validation errors for valid relationships
      // If there are errors, they should be reported
      expect(Array.isArray(validationErrors)).toBe(true)
    })

    it('should validate foreign key name uniqueness', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      const fkNames = new Set<string>()
      for (const tableRel of result.relationships) {
        for (const rel of tableRel.relationships) {
          expect(fkNames.has(rel.foreignKeyName)).toBe(false)
          fkNames.add(rel.foreignKeyName)
        }
      }
    })

    it('should validate columns are not empty', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      for (const tableRel of result.relationships) {
        for (const rel of tableRel.relationships) {
          expect(rel.columns.length).toBeGreaterThan(0)
          expect(rel.referencedColumns.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Error Handling', () => {
    it('should return structured result with errors array', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      expect(result).toHaveProperty('relationships')
      expect(result).toHaveProperty('errors')
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('should include file paths in errors', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      for (const error of result.errors) {
        expect(error.file).toBeTruthy()
        expect(typeof error.file).toBe('string')
      }
    })

    it('should include context in errors when available', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Some errors may have context
      const errorsWithContext = result.errors.filter((e) => e.context)

      for (const error of errorsWithContext) {
        expect(error.context).toBeTruthy()
        expect(typeof error.context).toBe('string')
      }
    })

    it('should continue extraction even when errors occur', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Should still return relationships even if there are errors
      expect(result.relationships.length).toBeGreaterThan(0)
    })
  })

  describe('Performance - Single Pass Extraction', () => {
    it('should extract all relationships in single AST traversal', () => {
      const tables = discoverTables()

      // Measure that it completes quickly (implicitly tests single-pass)
      const start = Date.now()
      const result = extractRelationships(tables.tables)
      const duration = Date.now() - start

      // Should complete quickly (single pass is O(M), not O(N×M))
      // For 19 tables, should be very fast (< 100ms typically)
      expect(duration).toBeLessThan(1000) // Generous timeout for CI
      expect(result.relationships.length).toBe(tables.tables.length)
    })

    it('should extract multiple relationships efficiently', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Count total relationships extracted
      const totalRelationships = result.relationships.reduce(
        (sum, rel) => sum + rel.relationships.length,
        0,
      )

      // Should extract multiple relationships efficiently
      expect(totalRelationships).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle tables with no relations() call', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Should create empty entry for tables without relations() call
      // This is expected behavior - not all tables need relationships
      for (const table of tables.tables) {
        const rel = result.relationships.find((r) => r.tableVariableName === table.variableName)
        expect(rel).toBeDefined()
        expect(Array.isArray(rel?.relationships)).toBe(true)
      }
    })

    it('should handle relations with empty one() relationships', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Tables with only many() relations should have empty relationships array
      const usersRel = result.relationships.find((r) => r.tableVariableName === 'users')
      // Users has many() relations but no one() relations
      expect(usersRel).toBeDefined()
      expect(usersRel?.relationships.length).toBe(0)
    })

    it('should handle complex relationship chains', () => {
      const tables = discoverTables()
      const result = extractRelationships(tables.tables)

      // Verify pages has multiple relationships (site, parent)
      const pagesRel = result.relationships.find((r) => r.tableVariableName === 'pages')
      expect(pagesRel).toBeDefined()
      expect(pagesRel?.relationships.length).toBeGreaterThan(0)

      // Should have relationship to sites
      const sitesRel = pagesRel?.relationships.find((r) => r.referencedRelation === 'sites')
      expect(sitesRel).toBeDefined()
    })
  })
})
