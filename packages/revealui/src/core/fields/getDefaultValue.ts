/**
 * Get Default Value for Field
 * @module @revealui/core/fields/getDefaultValue
 */

import type { Field } from './config/types.js'

interface GetDefaultValueArgs {
  field: Field
  locale?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any
}

/**
 * Gets the default value for a field
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDefaultValue({ field, locale, user }: GetDefaultValueArgs): any {
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
