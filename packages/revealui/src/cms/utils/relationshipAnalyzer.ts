import type { RevealCollectionConfig, RevealField, RelationshipMetadata } from '../types/index.js'
import toSnakeCase from 'to-snake-case'

/**
 * Analyzes a collection config and extracts all relationship fields with their metadata.
 * This is the foundation for depth-based relationship population.
 *
 * Based on RevealUI CMS analysis:
 * - Simple relationships (single, no hasMany): Direct Foreign Keys
 * - hasMany relationships: Junction Tables
 * - Polymorphic relationships (relationTo array): Junction Tables with multiple FK columns
 */
export function getRelationshipFields(collectionConfig: RevealCollectionConfig): RelationshipMetadata[] {
  const relationships: RelationshipMetadata[] = []
  const tableName = toSnakeCase(collectionConfig.slug)

  // Recursively traverse fields to find all relationships
  function traverseFields(fields: RevealField[], currentPath = ''): void {
    for (const field of fields) {
      const fieldName = field.name || ''
      const fieldPath = currentPath ? `${currentPath}.${fieldName}` : fieldName

      // Check if this is a relationship field
      if (field.type === 'relationship' || field.type === 'upload') {
        const metadata = createRelationshipMetadata(field, fieldPath || '', tableName)
        if (metadata) {
          relationships.push(metadata)
        }
      }

      // Recursively check nested fields (for arrays, groups, etc.)
      if ('fields' in field && Array.isArray(field.fields)) {
        traverseFields(field.fields, fieldPath)
      }
    }
  }

  traverseFields(collectionConfig.fields)
  return relationships
}

/**
 * Creates relationship metadata for a single field.
 * Determines storage type based on field properties following RevealUI CMS patterns.
 */
function createRelationshipMetadata(
  field: RevealField,
  fieldPath: string,
  parentTableName: string
): RelationshipMetadata | null {
  // Skip if not a relationship field
  if (field.type !== 'relationship' && field.type !== 'upload') {
    return null
  }

  // Skip if no relationTo (shouldn't happen but safety check)
  if (!field.relationTo) {
    return null
  }

  const relationTo = field.relationTo
  const hasMany = field.hasMany || false
  const isPolymorphic = Array.isArray(relationTo)

  // Determine storage type based on RevealUI CMS analysis
  let storageType: RelationshipMetadata['storageType']
  if (isPolymorphic) {
    storageType = 'polymorphic'
  } else if (hasMany) {
    storageType = 'junction_table'
  } else {
    storageType = 'direct_fk'
  }

  // Generate table/column names
  const tableName = storageType === 'direct_fk'
    ? parentTableName // main table for direct FKs
    : `${parentTableName}_rels` // junction table

  const fkColumnName = storageType === 'direct_fk'
    ? `${field.name}_id` // e.g., author_id
    : '' // junction tables have multiple FK columns

  return {
    fieldName: field.name,
    storageType,
    relationTo,
    hasMany,
    localized: false, // TODO: detect localization from collection/global context
    tableName,
    fkColumnName,
    path: fieldPath,
  }
}

/**
 * Validates relationship metadata for consistency and correctness.
 * Used during development to catch configuration errors early.
 */
export function validateRelationshipMetadata(metadata: RelationshipMetadata[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  for (const rel of metadata) {
    // Validate storage type logic
    if (rel.storageType === 'polymorphic' && !Array.isArray(rel.relationTo)) {
      errors.push(`Polymorphic relationship ${rel.fieldName} must have array relationTo`)
    }

    if (rel.storageType === 'direct_fk' && rel.hasMany) {
      errors.push(`Direct FK relationship ${rel.fieldName} cannot have hasMany=true`)
    }

    if (rel.storageType !== 'direct_fk' && rel.fkColumnName) {
      errors.push(`Non-direct-FK relationship ${rel.fieldName} should not have fkColumnName`)
    }

    // Validate table name format
    if (rel.storageType === 'direct_fk' && rel.tableName?.includes('_rels')) {
      errors.push(`Direct FK relationship ${rel.fieldName} should not use _rels table`)
    }

    if (rel.storageType !== 'direct_fk' && rel.tableName && !rel.tableName.includes('_rels')) {
      errors.push(`Junction table relationship ${rel.fieldName} should use _rels table`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
