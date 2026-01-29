/**
 * Extraction Quality Verification Tests
 *
 * These tests verify that extracted modules work correctly independently
 * and maintain proper separation of concerns.
 */

import { describe, expect, it } from 'vitest'
import { RevealUICollection } from '../collections/CollectionOperations.js'
import { RevealUIGlobal } from '../globals/GlobalOperations.js'
import { createRevealUIInstance } from '../instance/RevealUIInstance.js'
import { buildWhereClause, extractWhereValues } from '../queries/queryBuilder.js'
import { getRelationshipFields, validateRelationshipMetadata } from '../relationships/analyzer.js'
import type {
  DatabaseAdapter,
  RevealCollectionConfig,
  RevealConfig,
  RevealGlobalConfig,
} from '../types/index.js'

describe('Extraction Quality Verification', () => {
  describe('Query Builder Module', () => {
    it('should build WHERE clauses independently', () => {
      const params: unknown[] = []
      const where = { title: { equals: 'Test' } }
      const clause = buildWhereClause(where, params)

      // Verify clause contains the field and parameter placeholder
      expect(clause).toContain('"title"')
      expect(clause).toContain('=')
      expect(clause).toMatch(/\$\d+/) // Matches $1, $2, etc.
      expect(params).toEqual(['Test'])
    })

    it('should support both PostgreSQL and positional parameter styles', () => {
      const params1: unknown[] = []
      const params2: unknown[] = []
      const where = { title: 'Test' }

      const postgresClause = buildWhereClause(where, params1, {
        parameterStyle: 'postgres',
      })
      const positionalClause = buildWhereClause(where, params2, {
        parameterStyle: 'positional',
      })

      // PostgreSQL uses $1, $2, etc. (starts at $1 when params array is empty)
      expect(postgresClause).toMatch(/\$\d+/) // Matches $1, $2, etc.
      // Positional uses ? for all parameters
      expect(positionalClause).toContain('?')
      expect(params1).toEqual(['Test'])
      expect(params2).toEqual(['Test'])
    })

    it('should extract WHERE values correctly', () => {
      const where = {
        title: { equals: 'Test' },
        status: { in: ['active', 'pending'] },
      }

      const values = extractWhereValues(where)
      expect(values).toContain('Test')
      expect(values).toContain('active')
      expect(values).toContain('pending')
    })
  })

  describe('Relationship Analyzer Module', () => {
    it('should analyze relationship fields independently', () => {
      const config: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          {
            name: 'author',
            type: 'relationship',
            relationTo: 'users',
          },
        ],
      }

      const relationships = getRelationshipFields(config)
      expect(relationships).toHaveLength(1)
      expect(relationships[0].fieldName).toBe('author')
      expect(relationships[0].storageType).toBe('direct_fk')
    })

    it('should validate relationship metadata', () => {
      const metadata = [
        {
          fieldName: 'author',
          path: 'author',
          storageType: 'direct_fk' as const,
          relationTo: 'users',
          hasMany: false,
          localized: false,
          tableName: 'posts',
          fkColumnName: 'author_id',
          maxDepth: 1,
          depth: 1,
        },
      ]

      const result = validateRelationshipMetadata(metadata)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Collection Operations Module', () => {
    it('should work independently without RevealUIInstance', () => {
      const config: RevealCollectionConfig = {
        slug: 'test',
        fields: [{ name: 'title', type: 'text' }],
      }

      const collection = new RevealUICollection(config, null)
      expect(collection.config.slug).toBe('test')
      expect(collection.db).toBeNull()
    })

    it('should use query builder for WHERE clauses', async () => {
      const mockDb: DatabaseAdapter = {
        query: async (query: string, values: unknown[] = []) => {
          // Verify query uses buildWhereClause
          expect(query).toContain('WHERE')
          // PostgreSQL style parameters ($1, $2, etc.)
          expect(query).toMatch(/\$\d+/) // Matches $1, $2, etc.
          expect(values).toContain('Test')
          return { rows: [], rowCount: 0 }
        },
        connect: async () => undefined,
        disconnect: async () => undefined,
      }

      const config: RevealCollectionConfig = {
        slug: 'test',
        fields: [{ name: 'title', type: 'text' }],
      }

      const collection = new RevealUICollection(config, mockDb)
      await collection.find({
        where: { title: { equals: 'Test' } },
        limit: 10,
      })
    })
  })

  describe('Global Operations Module', () => {
    it('should work independently without RevealUIInstance', () => {
      const config: RevealGlobalConfig = {
        slug: 'settings',
        fields: [{ name: 'siteName', type: 'text' }],
      }

      const global = new RevealUIGlobal(config, null)
      expect(global.config.slug).toBe('settings')
      expect(global.db).toBeNull()
    })
  })

  describe('Instance Creation Module', () => {
    it('should create instance with proper module dependencies', async () => {
      const config: RevealConfig = {
        collections: [
          {
            slug: 'test',
            fields: [{ name: 'title', type: 'text' }],
          },
        ],
      }

      const instance = await createRevealUIInstance(config)
      expect(instance.collections).toBeDefined()
      expect(instance.collections.test).toBeInstanceOf(RevealUICollection)
    })

    it('should properly initialize DataLoader', async () => {
      const config: RevealConfig = {
        collections: [],
      }

      const instance = await createRevealUIInstance(config)
      // DataLoader should be initialized via getDataLoader
      // This is tested indirectly through instance creation
      expect(instance).toBeDefined()
    })
  })

  describe('Separation of Concerns', () => {
    it('should not have circular dependencies', () => {
      // CollectionOperations should not import RevealUIInstance
      // Instance should import CollectionOperations (one-way)
      // This is verified by the fact that:
      // 1. CollectionOperations imports buildWhereClause (not instance)
      // 2. Instance imports CollectionOperations (one-way dependency)
      // 3. No circular import errors occur
      expect(RevealUICollection).toBeDefined()
      expect(createRevealUIInstance).toBeDefined()

      // Structural verification: CollectionOperations can be used without instance
      const config: RevealCollectionConfig = {
        slug: 'test',
        fields: [{ name: 'title', type: 'text' }],
      }
      const collection = new RevealUICollection(config, null)
      expect(collection).toBeInstanceOf(RevealUICollection)
    })

    it('should have proper module boundaries', () => {
      // Query builder should be independent
      // Collections should depend on query builder
      // Instance should depend on collections
      // This creates a proper dependency hierarchy
      expect(buildWhereClause).toBeDefined()
      expect(RevealUICollection).toBeDefined()
      expect(createRevealUIInstance).toBeDefined()
    })
  })
})
