import { ClaudeCodeGenerator } from './claude-code.js';
import { CursorGenerator } from './cursor.js';
import { OpenCodeGenerator } from './opencode.js';
import type { ContentGenerator } from './types.js';
import { VSCodeGenerator } from './vscode.js';

export { ClaudeCodeGenerator } from './claude-code.js';
export { CursorGenerator } from './cursor.js';
export { OpenCodeGenerator } from './opencode.js';
export type { ContentGenerator, DiffEntry, GeneratedFile } from './types.js';
export { DEFAULT_CONTENT_GENERATOR_ID, MANAGER_CONTENT_OUTPUT } from './types.js';
export { VSCodeGenerator } from './vscode.js';

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

// Built-in generators, registered eagerly so `generateContent()` /
// `diffContent()` (content/index.ts) work out of the box for any importer
// of this module -- no manual registration call required.
registerGenerator(new OpenCodeGenerator());
registerGenerator(new CursorGenerator());
registerGenerator(new VSCodeGenerator());
registerGenerator(new ClaudeCodeGenerator());
