import { ClaudeCodeGenerator } from './claude.js';
import { CursorGenerator } from './cursor.js';
import type { ContentGenerator } from './types.js';

export { ClaudeCodeGenerator } from './claude.js';
export { CursorGenerator } from './cursor.js';
export type { ContentGenerator, DiffEntry, GeneratedFile } from './types.js';

const generators = new Map<string, ContentGenerator>([
  ['claude-code', new ClaudeCodeGenerator()],
  ['cursor', new CursorGenerator()],
]);

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
