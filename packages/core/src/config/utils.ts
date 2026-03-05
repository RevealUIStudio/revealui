export function deepMerge<T extends object>(target: Partial<T>, source: T): T {
  const result = { ...target } as T
  for (const key of Object.keys(source) as (keyof T)[]) {
    const s = source[key]
    const t = (target as T)[key]
    if (Array.isArray(s)) {
      result[key] = s as T[keyof T]
    } else if (
      s !== null &&
      typeof s === 'object' &&
      t !== null &&
      typeof t === 'object' &&
      !Array.isArray(t)
    ) {
      result[key] = deepMerge(
        t as Partial<T[keyof T] & object>,
        s as T[keyof T] & object,
      ) as T[keyof T]
    } else {
      result[key] = s
    }
  }
  return result
}

/**
 * @deprecated This function is deprecated. Use ConfigContract validation instead.
 * Validation is now handled by the contract system in @revealui/contracts/cms.
 * This function is kept for backward compatibility but should not be used in new code.
 */
export function validateConfig(config: {
  secret?: string
  collections?: unknown[]
  globals?: unknown[]
}): void {
  if (!config.secret) {
    throw new Error('RevealUI config requires a secret')
  }

  if (!(config.collections || config.globals)) {
    throw new Error('RevealUI config must have at least one collection or global')
  }
}
