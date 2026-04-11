import type { ContentGenerator } from './types.js';

export type { ContentGenerator, DiffEntry, GeneratedFile } from './types.js';

const generators = new Map<string, ContentGenerator>();

/** Get a generator by ID. */
export function getGenerator(id: string): ContentGenerator | undefined {
  return generators.get(id);
}

/** Register a custom generator. */
export function registerGenerator(generator: ContentGenerator): void {
  generators.set(generator.id, generator);
}

/** List all registered generator IDs. */
export function listGenerators(): string[] {
  return [...generators.keys()];
}
