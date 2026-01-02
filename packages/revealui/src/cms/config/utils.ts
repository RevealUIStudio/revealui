import deepmerge from 'deepmerge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge<T extends object>(target: Partial<T>, source: T): T {
  return deepmerge(target, source, {
    arrayMerge: (_target, source) => source,
  }) as T;
}

export function validateConfig(config: { secret?: string; collections?: unknown[]; globals?: unknown[] }): void {
  if (!config.secret) {
    throw new Error('RevealUI config requires a secret');
  }

  if (!config.collections && !config.globals) {
    throw new Error('RevealUI config must have at least one collection or global');
  }
}

