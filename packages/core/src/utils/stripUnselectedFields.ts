import type { Field, SelectType } from '../types/index.js'

/**
 * Strips unselected fields from a document based on select configuration
 */
export const stripUnselectedFields = ({
  field,
  select,
  siblingDoc,
}: {
  field: Field
  select: SelectType
  siblingDoc: Record<string, unknown>
}): void => {
  if (!select || typeof select !== 'object') return
  const fieldName = field.name || ''
  if (!fieldName) return

  const fieldValue = siblingDoc[fieldName]

  // Only process if field value is an object (not primitive types)
  if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
    for (const key of Object.keys(fieldValue as Record<string, unknown>)) {
      if (!(key in select)) {
        delete (fieldValue as Record<string, unknown>)[key]
      }
    }
  }
}
