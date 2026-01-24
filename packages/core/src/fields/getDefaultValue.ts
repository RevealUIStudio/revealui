/**
 * Get Default Value for Field
 * @module @revealui/core/fields/getDefaultValue
 */

import type { Field } from './config/types.js'

interface GetDefaultValueArgs {
  field: Field
  locale?: string | null
  user?: unknown
}

/**
 * Gets the default value for a field
 */
export function getDefaultValue({ field, locale, user }: GetDefaultValueArgs): unknown {
  void locale
  void user

  if ('defaultValue' in field) {
    if (typeof field.defaultValue === 'function') {
      return field.defaultValue({ locale, user })
    }
    return field.defaultValue
  }

  // Return undefined for fields without default values
  return undefined
}

export default getDefaultValue
