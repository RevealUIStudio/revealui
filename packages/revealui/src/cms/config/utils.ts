import deepmerge from 'deepmerge';

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  return deepmerge(target, source, {
    arrayMerge: (target, source) => source,
  });
}

export function validateConfig(config: Record<string, unknown>): void {
  if (!config.secret) {
    throw new Error('RevealUI config requires a secret');
  }

  if (!config.collections && !config.globals) {
    throw new Error('RevealUI config must have at least one collection or global');
  }
}

