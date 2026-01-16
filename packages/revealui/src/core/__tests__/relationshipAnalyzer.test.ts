/**
 * Test file for Relationship Field Analyzer (Step 1.1)
 *
 * This file tests the getRelationshipFields function with various
 * field configurations to ensure correct storage type detection.
 */

import { describe, expect, it } from 'vitest'
import { getRelationshipFields } from '../revealui.js'
import type { RevealCollectionConfig } from '../types/index.js'

// Test collection with various relationship types
const testCollectionConfig: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    // Direct FK relationship (single, no hasMany)
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    // hasMany relationship (junction table)
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    // Polymorphic relationship (multiple relationTo)
    {
      name: 'relatedContent',
      type: 'relationship',
      relationTo: ['posts', 'pages'],
      hasMany: true,
    },
    // Upload field (treated as single relationship)
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
    },
    // Non-relationship field (should be ignored)
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    // Array field with relationship (should be detected)
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'relationship',
          relationTo: 'tags',
        },
      ],
    },
  ],
}

// Expected results
const expectedRelationships = [
  {
    fieldName: 'author',
    storageType: 'direct_fk' as const,
    relationTo: 'users',
    hasMany: false,
    localized: false,
    fkColumnName: 'author_id',
    path: 'author',
    maxDepth: 1,
  },
  {
    fieldName: 'categories',
    storageType: 'junction_table' as const,
    relationTo: 'categories',
    hasMany: true,
    localized: false,
    tableName: 'posts_rels',
    path: 'categories',
    maxDepth: 1,
  },
  {
    fieldName: 'relatedContent',
    storageType: 'polymorphic' as const,
    relationTo: ['posts', 'pages'],
    hasMany: true,
    localized: false,
    tableName: 'posts_rels',
    path: 'relatedContent',
    maxDepth: 1,
  },
  {
    fieldName: 'featuredImage',
    storageType: 'direct_fk' as const,
    relationTo: 'media',
    hasMany: false,
    localized: false,
    fkColumnName: 'featuredImage_id',
    path: 'featuredImage',
    maxDepth: 1,
  },
  {
    fieldName: 'tag',
    storageType: 'direct_fk' as const,
    relationTo: 'tags',
    hasMany: false,
    localized: false,
    fkColumnName: 'tag_id',
    path: 'tags.tag',
    maxDepth: 1,
  },
]

describe('Relationship Field Analyzer', () => {
  it('should extract all relationship fields with correct metadata', () => {
    const result = getRelationshipFields(testCollectionConfig)

    // Check count
    expect(result.length).toBe(expectedRelationships.length)

    // Check each relationship
    for (let i = 0; i < Math.min(result.length, expectedRelationships.length); i++) {
      const actual = result[i]
      const expected = expectedRelationships[i]

      expect(actual.fieldName).toBe(expected.fieldName)
      expect(actual.storageType).toBe(expected.storageType)
      expect(JSON.stringify(actual.relationTo)).toBe(JSON.stringify(expected.relationTo))
      expect(actual.hasMany).toBe(expected.hasMany)
      expect(actual.path).toBe(expected.path)

      // Check tableName (may be undefined for direct_fk)
      if (expected.tableName) {
        expect(actual.tableName).toBe(expected.tableName)
      }

      // Check fkColumnName (may be undefined for junction tables)
      if (expected.fkColumnName) {
        expect(actual.fkColumnName).toBe(expected.fkColumnName)
      }
    }
  })

  it('should detect direct FK relationships', () => {
    const result = getRelationshipFields(testCollectionConfig)
    const authorRel = result.find((r) => r.fieldName === 'author')

    expect(authorRel).toBeDefined()
    expect(authorRel?.storageType).toBe('direct_fk')
    expect(authorRel?.hasMany).toBe(false)
    expect(authorRel?.fkColumnName).toBe('author_id')
  })

  it('should detect junction table relationships', () => {
    const result = getRelationshipFields(testCollectionConfig)
    const categoriesRel = result.find((r) => r.fieldName === 'categories')

    expect(categoriesRel).toBeDefined()
    expect(categoriesRel?.storageType).toBe('junction_table')
    expect(categoriesRel?.hasMany).toBe(true)
    expect(categoriesRel?.tableName).toContain('_rels')
  })

  it('should detect polymorphic relationships', () => {
    const result = getRelationshipFields(testCollectionConfig)
    const relatedContentRel = result.find((r) => r.fieldName === 'relatedContent')

    expect(relatedContentRel).toBeDefined()
    expect(relatedContentRel?.storageType).toBe('polymorphic')
    expect(Array.isArray(relatedContentRel?.relationTo)).toBe(true)
  })

  it('should handle nested relationship fields in arrays', () => {
    const result = getRelationshipFields(testCollectionConfig)
    const tagRel = result.find((r) => r.fieldName === 'tag' && r.path === 'tags.tag')

    expect(tagRel).toBeDefined()
    expect(tagRel?.path).toBe('tags.tag')
  })
})
