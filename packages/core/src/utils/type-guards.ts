/**
 * Type Guard Utilities
 *
 * Utilities for checking field types and JSON field detection.
 * The Field interface already includes hasMany, so simple checks are sufficient.
 */

import type { Field } from '@revealui/contracts/cms'
import type { RevealUIField } from '../types/extensions.js'

/**
 * Check if a field should be stored as JSON
 *
 * JSON fields include:
 * - Complex types (array, group, blocks, richText)
 * - Select fields with hasMany
 * - Relationship fields with hasMany (stored as JSON array)
 *
 * Note: Field extends FieldStructure which has 'type' and 'hasMany' properties.
 */
export function isJsonFieldType(field: RevealUIField | Field): boolean {
  const jsonTypes = ['array', 'group', 'blocks', 'richText']

  if (field.type && jsonTypes.includes(field.type)) {
    return true
  }

  // Check for select/relationship fields with hasMany
  if (field.type === 'select' && field.hasMany === true) {
    return true
  }

  if (field.type === 'relationship' && field.hasMany === true) {
    return true
  }

  return false
}

/**
 * Type guard to check if a value is a plain object (not null, array, or Date)
 *
 * @param item - Value to check
 * @returns True if value is a plain object
 */
export function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item)
}
