/**
 * Get Field Paths
 * @module @revealui/core/fields/getFieldPaths
 */

import type { Field } from './config/types.js'

interface GetFieldPathsArgs {
  field: Field
  path?: string
  parentPath?: string
  parentIsLocalized?: boolean
}

interface FieldPathInfo {
  path: string
  schemaPath: string
}

/**
 * Gets the path information for a field, handling nested structures
 */
export function getFieldPaths({
  field,
  path,
  parentPath = '',
  parentIsLocalized = false,
}: GetFieldPathsArgs): FieldPathInfo {
  void parentIsLocalized

  const fieldName = field.name || ''
  const fieldPath = path || (parentPath ? `${parentPath}.${fieldName}` : fieldName)

  return {
    path: fieldPath,
    schemaPath: fieldPath,
  }
}

/**
 * Modified version for compatibility
 */
export function getFieldPathsModified(args: GetFieldPathsArgs): FieldPathInfo {
  return getFieldPaths(args)
}

export default getFieldPaths
