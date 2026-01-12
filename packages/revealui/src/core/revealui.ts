/**
 * RevealUI Core Implementation
 *
 * Main entry point that re-exports from organized modules.
 */

// Collection and Global operations
export { RevealUICollection } from './collections/CollectionOperations'
export { RevealUIGlobal } from './globals/GlobalOperations'
// Logger
export { createLogger, defaultLogger, Logger, type RevealUILogger } from './instance/logger'
// Main instance creation
export { createRevealUIInstance } from './instance/RevealUIInstance'
// Query utilities
export { buildWhereClause, extractWhereValues } from './queries/queryBuilder'
// Relationship utilities
export { getRelationshipFields, validateRelationshipMetadata } from './relationships/analyzer'
export { relationshipPopulationPromise } from './relationships/population'

// Utilities
export { flattenResult } from './utils/flattenResult'

import { traverseFieldsCore } from './fieldTraversal'
// Field traversal utilities (keep existing exports)
import type { RevealUITraverseFieldsArgs, RevealUITraverseFieldsResult } from './types/index'

export async function afterChangeTraverseFields(
  args: RevealUITraverseFieldsArgs,
): Promise<RevealUITraverseFieldsResult> {
  // Traverse fields after changes have been made
  // This allows post-processing, side effects, and cleanup
  return traverseFieldsCore(args, 'afterChange')
}

export async function afterReadTraverseFields(
  args: RevealUITraverseFieldsArgs,
): Promise<RevealUITraverseFieldsResult> {
  // Traverse fields after data has been read from the database
  // This allows formatting, transformation, and relationship population
  return traverseFieldsCore(args, 'afterRead')
}

export async function beforeChangeTraverseFields(
  args: RevealUITraverseFieldsArgs,
): Promise<RevealUITraverseFieldsResult> {
  // Traverse fields before changes are applied
  // This allows validation, transformation, and default value assignment
  return traverseFieldsCore(args, 'beforeChange')
}

export async function beforeValidateTraverseFields(
  args: RevealUITraverseFieldsArgs,
): Promise<RevealUITraverseFieldsResult> {
  // Traverse fields before validation runs
  // This allows data preparation, type coercion, and required field checks
  return traverseFieldsCore(args, 'beforeValidate')
}

// Dependency checking utility
import type { RevealUIDependencyCheckArgs } from './types/index'

export function checkDependencies(args: RevealUIDependencyCheckArgs): boolean {
  const { field } = args

  // Check for conditional fields (fields that depend on other fields via admin.condition)
  if (
    'admin' in field &&
    field.admin &&
    typeof field.admin === 'object' &&
    'condition' in field.admin
  ) {
    const condition = field.admin.condition

    // If condition is a function, we can't evaluate it without data
    // Return true to allow the field to be processed (validation will happen later with data)
    if (typeof condition === 'function') {
      // Condition functions require data to evaluate, so we can't check dependencies here
      // This is acceptable - conditions are evaluated at runtime when data is available
      return true
    }

    // If condition is a boolean or other simple type, evaluate it directly
    if (typeof condition === 'boolean') {
      return condition
    }
  }

  // Check for relationship dependencies
  if (field.type === 'relationship' || field.type === 'upload') {
    // Validate that relationTo is specified
    if ('relationTo' in field && field.relationTo) {
      const relationTo = field.relationTo
      const targetCollections = Array.isArray(relationTo) ? relationTo : [relationTo]

      // Basic validation: ensure we have at least one target collection
      // In a full implementation, we'd check if the collections exist in the config
      return (
        targetCollections.length > 0 &&
        targetCollections.every((coll) => typeof coll === 'string' && coll.length > 0)
      )
    }

    // Relationship field without relationTo is invalid
    return false
  }

  // No dependencies found or all dependencies are valid
  return true
}

// Deep merge utility
export function deepMergeSimple<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  // Type-safe deep merge implementation
  const result = { ...target }
  for (const key in source) {
    const sourceValue = source[key]
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      const targetValue = result[key]
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMergeSimple(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    } else {
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }
  return result
}

import type { JSONSchema4TypeName } from 'json-schema'
import type React from 'react'
// Type exports for richtext-lexical compatibility
import type {
  RevealUIBlock,
  RevealUIEnhancedField,
  RevealUIField,
  RevealUIRichTextAdapter,
} from './types/index'

export type { Field, RevealUIField, SanitizedConfig } from './types/index'
export type StaticLabel = string // Simple string type for labels
export type ServerFieldBase = RevealUIField // Alias for field base types
export type RichTextAdapter = RevealUIRichTextAdapter // Rich text adapter type
export type RichTextField = RevealUIEnhancedField // Rich text field type

// Basic types
export type Data = Record<string, unknown>
export type FormState = Record<string, unknown>

// Config types
export type { CollectionConfig, Config, GlobalConfig } from './types/index'

// Component types (simplified aliases)
export type BlocksFieldClient = React.ComponentType<Record<string, unknown>>
export type ClientBlock = React.ComponentType<Record<string, unknown>>
export type CodeFieldClient = React.ComponentType<Record<string, unknown>>
export type CodeFieldClientProps = Record<string, unknown>
export type BlocksField = RevealUIField

// Block types
export type Block = RevealUIBlock
export type BlockJSX = React.ReactElement
export type BlockSlug = string

// JSON Schema utility
export function withNullableJSONSchemaType(
  typeName: JSONSchema4TypeName,
  isRequired: boolean,
): JSONSchema4TypeName | JSONSchema4TypeName[] | undefined {
  // Return the type name, or an array including null if not required
  return isRequired ? typeName : [typeName, 'null']
}
