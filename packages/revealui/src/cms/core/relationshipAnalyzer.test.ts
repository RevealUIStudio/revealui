/**
 * Test file for Relationship Field Analyzer (Step 1.1)
 *
 * This file tests the getRelationshipFields function with various
 * field configurations to ensure correct storage type detection.
 */

import { getRelationshipFields } from './payload'
import type { RevealCollectionConfig } from '../types/index'

// Test collection with various relationship types
const testCollectionConfig: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    // Direct FK relationship (single, no hasMany)
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true
    },
    // hasMany relationship (junction table)
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true
    },
    // Polymorphic relationship (multiple relationTo)
    {
      name: 'relatedContent',
      type: 'relationship',
      relationTo: ['posts', 'pages'],
      hasMany: true
    },
    // Upload field (treated as single relationship)
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media'
    },
    // Non-relationship field (should be ignored)
    {
      name: 'title',
      type: 'text',
      required: true
    },
    // Array field with relationship (should be detected)
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'relationship',
          relationTo: 'tags'
        }
      ]
    }
  ]
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
    maxDepth: 1
  },
  {
    fieldName: 'categories',
    storageType: 'junction_table' as const,
    relationTo: 'categories',
    hasMany: true,
    localized: false,
    tableName: 'posts_rels',
    path: 'categories',
    maxDepth: 1
  },
  {
    fieldName: 'relatedContent',
    storageType: 'polymorphic' as const,
    relationTo: ['posts', 'pages'],
    hasMany: true,
    localized: false,
    tableName: 'posts_rels',
    path: 'relatedContent',
    maxDepth: 1
  },
  {
    fieldName: 'featuredImage',
    storageType: 'direct_fk' as const,
    relationTo: 'media',
    hasMany: false,
    localized: false,
    fkColumnName: 'featuredImage_id',
    path: 'featuredImage',
    maxDepth: 1
  },
  {
    fieldName: 'tag',
    storageType: 'direct_fk' as const,
    relationTo: 'tags',
    hasMany: false,
    localized: false,
    fkColumnName: 'tag_id',
    path: 'tags.tag',
    maxDepth: 1
  }
]

// Test function
export function testRelationshipAnalyzer() {
  console.log('🧪 Testing Relationship Field Analyzer...')

  const result = getRelationshipFields(testCollectionConfig, 'posts')

  console.log('📊 Analysis Result:', JSON.stringify(result, null, 2))

  // Validate results
  const issues: string[] = []

  // Check count
  if (result.length !== expectedRelationships.length) {
    issues.push(`Expected ${expectedRelationships.length} relationships, got ${result.length}`)
  }

  // Check each relationship
  for (let i = 0; i < Math.min(result.length, expectedRelationships.length); i++) {
    const actual = result[i]
    const expected = expectedRelationships[i]

    if (actual.fieldName !== expected.fieldName) {
      issues.push(`Field ${i}: expected fieldName '${expected.fieldName}', got '${actual.fieldName}'`)
    }

    if (actual.storageType !== expected.storageType) {
      issues.push(`Field '${actual.fieldName}': expected storageType '${expected.storageType}', got '${actual.storageType}'`)
    }

    if (JSON.stringify(actual.relationTo) !== JSON.stringify(expected.relationTo)) {
      issues.push(`Field '${actual.fieldName}': expected relationTo '${JSON.stringify(expected.relationTo)}', got '${JSON.stringify(actual.relationTo)}'`)
    }

    if (actual.hasMany !== expected.hasMany) {
      issues.push(`Field '${actual.fieldName}': expected hasMany ${expected.hasMany}, got ${actual.hasMany}`)
    }

    if (actual.tableName !== expected.tableName) {
      issues.push(`Field '${actual.fieldName}': expected tableName '${expected.tableName}', got '${actual.tableName}'`)
    }

    if (actual.fkColumnName !== expected.fkColumnName) {
      issues.push(`Field '${actual.fieldName}': expected fkColumnName '${expected.fkColumnName}', got '${actual.fkColumnName}'`)
    }

    if (actual.path !== expected.path) {
      issues.push(`Field '${actual.fieldName}': expected path '${expected.path}', got '${actual.path}'`)
    }
  }

  // Report results
  if (issues.length === 0) {
    console.log('✅ All tests passed! Relationship analyzer working correctly.')
    return true
  } else {
    console.log('❌ Test failures:')
    issues.forEach(issue => console.log(`  - ${issue}`))
    return false
  }
}

// Manual validation with real Posts collection
export function validateWithPostsCollection(postsConfig: any) {
  console.log('🔍 Validating with actual Posts collection config...');

  try {
    const relationships = getRelationshipFields(postsConfig, 'posts');

    console.log(`📊 Found ${relationships.length} relationship fields:`);
    relationships.forEach(rel => {
      console.log(`  - ${rel.fieldName}: ${rel.storageType} (${rel.hasMany ? 'hasMany' : 'single'}) -> ${Array.isArray(rel.relationTo) ? rel.relationTo.join(', ') : rel.relationTo}`);
    });

    // Validate expected relationships
    const expectedFields = ['relatedPosts', 'categories', 'image'];
    const foundFields = relationships.map(r => r.fieldName);

    const missing = expectedFields.filter(f => !foundFields.includes(f));
    if (missing.length > 0) {
      console.log(`❌ Missing expected fields: ${missing.join(', ')}`);
      return false;
    }

    console.log('✅ Posts collection validation passed!');
    return true;

  } catch (error) {
    console.error('❌ Posts collection validation failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRelationshipAnalyzer()
}
