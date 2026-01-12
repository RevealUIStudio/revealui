import type { RevealDocument } from '../types/index'

/**
 * Flattens SQL result with dotted notation into nested objects
 * e.g., { 'author.title': 'John', 'author.id': 1 } -> { author: { title: 'John', id: 1 } }
 */
export function flattenResult(doc: RevealDocument): RevealDocument {
  const result = { ...doc }

  for (const key of Object.keys(doc)) {
    if (key.includes('.')) {
      const [parentKey, childKey] = key.split('.', 2)
      if (!result[parentKey]) {
        result[parentKey] = {}
      }
      ;(result[parentKey] as Record<string, unknown>)[childKey] = doc[key]
      delete result[key]
    }
  }

  return result
}
