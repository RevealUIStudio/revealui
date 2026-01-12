/**
 * Type Guard Utilities
 *
 * Utilities for checking field types and JSON field detection.
 * The Field interface already includes hasMany, so simple checks are sufficient.
 */

import type { RevealUIField } from '../types/extensions'

/**
 * Check if a field should be stored as JSON
 *
 * JSON fields include:
 * - Complex types (array, group, blocks, richText)
 * - Select fields with hasMany
 * - Relationship fields with hasMany (stored as JSON array)
 *
 * Note: Field interface already has hasMany, so no type guards needed.
 */
export function isJsonFieldType(field: RevealUIField): boolean {
  const jsonTypes = ['array', 'group', 'blocks', 'richText']
  if (jsonTypes.includes(field.type || '')) {
    return true
  }

  // Field interface already has hasMany, no need for type guards
  if (field.type === 'select' && field.hasMany === true) {
    return true
  }

  if (field.type === 'relationship' && field.hasMany === true) {
    return true
  }

  return false
}
