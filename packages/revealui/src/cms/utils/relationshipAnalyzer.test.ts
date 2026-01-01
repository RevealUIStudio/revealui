import { describe, expect, it } from '@jest/globals'
import type { RevealCollectionConfig } from '../types/index.js'
import { getRelationshipFields, validateRelationshipMetadata } from './relationshipAnalyzer.js'

// Test collection configs with different relationship types
const testCollections = {
  posts: {
    slug: 'posts',
    fields: [
      {
        name: 'author',
        type: 'relationship',
        relationTo: 'users',
        required: true,
      },
      {
        name: 'categories',
        type: 'relationship',
        relationTo: 'categories',
        hasMany: true,
      },
      {
        name: 'featuredMedia',
        type: 'upload',
        relationTo: 'media',
      },
      {
        name: 'contentBlocks',
        type: 'array',
        fields: [
          {
            name: 'media',
            type: 'upload',
            relationTo: 'media',
          },
        ],
      },
    ],
  } as RevealCollectionConfig,

  users: {
    slug: 'users',
    fields: [
      {
        name: 'avatar',
        type: 'upload',
        relationTo: 'media',
      },
      {
        name: 'tenants',
        type: 'relationship',
        relationTo: ['tenants', 'organizations'], // Polymorphic
        hasMany: true,
      },
    ],
  } as RevealCollectionConfig,
}

describe('Relationship Analyzer', () => {
  describe('getRelationshipFields', () => {
    it('should identify direct FK relationships', () => {
      const relationships = getRelationshipFields(testCollections.posts)

      const authorRel = relationships.find(r => r.fieldName === 'author')
      expect(authorRel).toBeDefined()
      expect(authorRel?.storageType).toBe('direct_fk')
      expect(authorRel?.relationTo).toBe('users')
      expect(authorRel?.hasMany).toBe(false)
      expect(authorRel?.fkColumnName).toBe('author_id')
      expect(authorRel?.tableName).toBe('posts')
    })

    it('should identify junction table relationships', () => {
      const relationships = getRelationshipFields(testCollections.posts)

      const categoriesRel = relationships.find(r => r.fieldName === 'categories')
      expect(categoriesRel).toBeDefined()
      expect(categoriesRel?.storageType).toBe('junction_table')
      expect(categoriesRel?.relationTo).toBe('categories')
      expect(categoriesRel?.hasMany).toBe(true)
      expect(categoriesRel?.tableName).toBe('posts_rels')
    })

    it('should identify upload relationships as direct FK', () => {
      const relationships = getRelationshipFields(testCollections.posts)

      const mediaRel = relationships.find(r => r.fieldName === 'featuredMedia')
      expect(mediaRel).toBeDefined()
      expect(mediaRel?.storageType).toBe('direct_fk')
      expect(mediaRel?.relationTo).toBe('media')
    })

    it('should identify polymorphic relationships', () => {
      const relationships = getRelationshipFields(testCollections.users)

      const tenantsRel = relationships.find(r => r.fieldName === 'tenants')
      expect(tenantsRel).toBeDefined()
      expect(tenantsRel?.storageType).toBe('polymorphic')
      expect(tenantsRel?.relationTo).toEqual(['tenants', 'organizations'])
      expect(tenantsRel?.hasMany).toBe(true)
      expect(tenantsRel?.tableName).toBe('users_rels')
    })

    it('should handle nested relationships in arrays', () => {
      const relationships = getRelationshipFields(testCollections.posts)

      const nestedMediaRel = relationships.find(r => r.path === 'contentBlocks.media')
      expect(nestedMediaRel).toBeDefined()
      expect(nestedMediaRel?.storageType).toBe('direct_fk')
      expect(nestedMediaRel?.path).toBe('contentBlocks.media')
    })
  })

  describe('validateRelationshipMetadata', () => {
    it('should validate correct metadata', () => {
      const relationships = getRelationshipFields(testCollections.posts)
      const validation = validateRelationshipMetadata(relationships)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should catch polymorphic relationship errors', () => {
      const invalidMetadata = [{
        fieldName: 'test',
        storageType: 'polymorphic' as const,
        relationTo: 'single-collection', // Should be array
        hasMany: false,
        localized: false,
        tableName: 'test_rels',
        fkColumnName: '',
        path: 'test',
      }]

      const validation = validateRelationshipMetadata(invalidMetadata)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Polymorphic relationship test must have array relationTo')
    })

    it('should catch direct FK with hasMany errors', () => {
      const invalidMetadata = [{
        fieldName: 'test',
        storageType: 'direct_fk' as const,
        relationTo: 'collection',
        hasMany: true, // Should be false for direct_fk
        localized: false,
        tableName: 'test',
        fkColumnName: 'test_id',
        path: 'test',
      }]

      const validation = validateRelationshipMetadata(invalidMetadata)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Direct FK relationship test cannot have hasMany=true')
    })
  })
})
