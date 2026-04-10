import { defaultLogger } from '../instance/logger.js';
import type { RevealCollectionConfig, RevealGlobalConfig, RevealUIField } from '../types/index.js';
import type { RelationshipMetadata } from '../types/query.js';

/**
 * Relationship Field Analyzer
 *
 * Analyzes a collection config and extracts all relationship fields with their metadata.
 * This is the foundation for depth-based relationship population.
 *
 * Based on RevealUI admin analysis:
 * - Simple relationships (single, no hasMany): Direct Foreign Keys
 * - hasMany relationships: Junction Tables
 * - Polymorphic relationships (relationTo array): Junction Tables with multiple FK columns
 */

/**
 * Shared type for configs that have fields and slug (collections and globals)
 */
type ConfigWithFields = {
  slug: string;
  fields: RevealUIField[];
};

/**
 * Analyzes a collection or global configuration and extracts all relationship fields
 * with their storage metadata for proper query building.
 *
 * @param config - The collection or global configuration to analyze
 * @param collectionSlug - Optional slug override (defaults to config.slug)
 * @returns Array of relationship metadata for all relationship fields
 */
export function getRelationshipFields(
  config: RevealCollectionConfig | RevealGlobalConfig | ConfigWithFields,
  collectionSlug?: string,
): RelationshipMetadata[] {
  const toSnakeCase = (string: string): string =>
    string
      ?.replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();

  const relationships: RelationshipMetadata[] = [];
  const tableName = toSnakeCase(collectionSlug || config.slug);
  // Recursively traverse fields to find all relationships
  function traverseFields(
    fields: RevealUIField[],
    currentPath = '',
    parentLocalized = false,
  ): void {
    for (const field of fields) {
      const fieldName = field.name || '';
      const fieldPath = currentPath ? `${currentPath}.${fieldName}` : fieldName;

      // Determine if field is localized (field-level or inherited from parent)
      // Note: Collection-level localization is not yet supported in RevealCollectionConfig type
      const isLocalized = field.localized === true || parentLocalized;

      // Check if this is a relationship field
      if (field.type === 'relationship' || field.type === 'upload') {
        const metadata = createRelationshipMetadata(field, fieldPath || '', tableName, isLocalized);
        if (metadata) {
          relationships.push(metadata);
        }
      }

      // Recursively check nested fields (for arrays, groups, blocks, etc.)
      if ('fields' in field && Array.isArray(field.fields)) {
        const nestedFields = field.fields as RevealUIField[];
        traverseFields(nestedFields, fieldPath, isLocalized);
      }

      // Check blocks
      if (field.type === 'blocks' && 'blocks' in field && Array.isArray(field.blocks)) {
        for (const block of field.blocks as Array<{ slug?: unknown; fields?: unknown }>) {
          if ('fields' in block && Array.isArray(block.fields)) {
            const blockFields = block.fields as RevealUIField[];
            const blockSlug = typeof block.slug === 'string' ? block.slug : 'block';
            traverseFields(blockFields, `${fieldPath}.${blockSlug}`, isLocalized);
          }
        }
      }
    }
  }

  traverseFields(config.fields);

  // Validate extracted metadata to catch configuration errors early
  const validation = validateRelationshipMetadata(relationships);
  if (!validation.valid) {
    for (const error of validation.errors) {
      defaultLogger.warn(`[RelationshipAnalyzer] ${error}`);
    }
  }

  return relationships;
}

/**
 * Creates relationship metadata for a single field.
 * Determines storage type based on field properties following RevealUI admin patterns.
 */
function createRelationshipMetadata(
  field: RevealUIField,
  fieldPath: string,
  parentTableName: string,
  isLocalized: boolean = false,
): RelationshipMetadata | null {
  // Skip if not a relationship field
  if (field.type !== 'relationship' && field.type !== 'upload') {
    return null;
  }

  // Skip if no relationTo (shouldn't happen but safety check)
  if (!field.relationTo) {
    return null;
  }

  const relationTo = field.relationTo;
  const hasMany = field.hasMany ?? false;
  const isPolymorphic = Array.isArray(relationTo);

  // Determine storage type based on RevealUI admin analysis
  let storageType: RelationshipMetadata['storageType'];
  if (isPolymorphic) {
    storageType = 'polymorphic';
  } else if (hasMany) {
    storageType = 'junction_table';
  } else {
    storageType = 'direct_fk';
  }

  // Generate table/column names
  const tableName =
    storageType === 'direct_fk'
      ? parentTableName // main table for direct FKs
      : `${parentTableName}_rels`; // junction table

  const fkColumnName =
    storageType === 'direct_fk'
      ? `${field.name}_id` // e.g., author_id
      : undefined; // junction tables have multiple FK columns

  return {
    fieldName: field.name,
    path: fieldPath,
    storageType,
    relationTo,
    hasMany,
    localized: isLocalized,
    tableName,
    fkColumnName,
    maxDepth: 1, // Default depth, will be configurable later
    depth: 1, // Default depth for queries
  };
}

/**
 * Validates relationship metadata for consistency and correctness.
 * Used during development to catch configuration errors early.
 */
export function validateRelationshipMetadata(metadata: RelationshipMetadata[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const rel of metadata) {
    // Validate storage type logic
    if (rel.storageType === 'polymorphic' && !Array.isArray(rel.relationTo)) {
      errors.push(`Polymorphic relationship ${rel.fieldName} must have array relationTo`);
    }

    if (rel.storageType === 'direct_fk' && rel.hasMany) {
      errors.push(`Direct FK relationship ${rel.fieldName} cannot have hasMany=true`);
    }

    if (rel.storageType !== 'direct_fk' && rel.fkColumnName) {
      errors.push(`Non-direct-FK relationship ${rel.fieldName} should not have fkColumnName`);
    }

    // Validate table name format
    if (rel.storageType === 'direct_fk' && rel.tableName?.includes('_rels')) {
      errors.push(`Direct FK relationship ${rel.fieldName} should not use _rels table`);
    }

    if (rel.storageType !== 'direct_fk' && rel.tableName && !rel.tableName.includes('_rels')) {
      errors.push(`Junction table relationship ${rel.fieldName} should use _rels table`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
