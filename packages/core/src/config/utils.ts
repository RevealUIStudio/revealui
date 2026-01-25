import deepmerge from 'deepmerge'

const overwriteArray = <TValue>(_target: TValue[], source: TValue[]): TValue[] => source

export function deepMerge<T extends object>(target: Partial<T>, source: T): T {
  return deepmerge<T>(target, source, {
    arrayMerge: overwriteArray,
  })
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
