import type { RevealConfig } from '../../../types/index.js'

/**
 * Recursively removes all functions from an object to make it serializable
 * for passing to client components in Next.js
 */
function removeFunctions<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'function') {
    return undefined as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map(removeFunctions).filter((item) => item !== undefined) as unknown as T
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value !== 'function') {
        const cleaned = removeFunctions(value)
        if (cleaned !== undefined) {
          result[key] = cleaned
        }
      }
    }
    return result as T
  }

  return obj
}

/**
 * Creates a serializable version of RevealConfig by removing all functions
 * This is necessary for passing config to client components in Next.js
 */
export function serializeConfig(config: RevealConfig): RevealConfig {
  return removeFunctions(config)
}
