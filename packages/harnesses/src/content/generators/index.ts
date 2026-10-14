import { resolveTemplate } from '../resolvers/index.js';
import type { ResolverContext } from '../resolvers/types.js';
import { hasRetiredFleetIdentity, type Manifest, ManifestSchema } from '../schemas/manifest.js';
import { ClaudeCodeGenerator } from './claude-code.js';
import { CursorGenerator } from './cursor.js';
import { GrokGenerator } from './grok.js';
import { OpenCodeGenerator } from './opencode.js';
import type { ContentGenerator, GeneratedFile } from './types.js';
import { VSCodeGenerator } from './vscode.js';

export { ClaudeCodeGenerator } from './claude-code.js';
export { CursorGenerator } from './cursor.js';
export {
  GROK_MANAGER_RULE_PATH,
  GROK_OUTPUT_DIR,
  GROK_SPAWN_MAP,
  GROK_SPAWN_MAP_PATH,
  GrokGenerator,
  grokAgentPath,
  grokCommandPath,
  grokOnDemandSkillPath,
  grokRulePathForDefinitionId,
} from './grok.js';
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

/** One project-aware generation path for materialize, sync, diff, and validation. */
export function generateContent(
  generatorId: string,
  manifest: Manifest,
  ctx: ResolverContext,
): GeneratedFile[] {
  const generator = getGenerator(generatorId);
  if (!generator)
    throw new Error(
      `Unknown generator "${generatorId}". Available: ${listGenerators().join(', ')}`,
    );
  const files = generator.generateAll(ManifestSchema.parse(manifest), ctx).map((file) => ({
    ...file,
    content: resolveTemplate(file.content, ctx),
  }));
  if (hasRetiredFleetIdentity(files)) {
    throw new Error('Generated fleet content must use revealfleet and REVEALFLEET.');
  }
  return files;
}

// Built-in generators, registered eagerly so `generateContent()` /
// `diffContent()` (content/index.ts) work out of the box for any importer
// of this module -- no manual registration call required.
registerGenerator(new OpenCodeGenerator());
registerGenerator(new CursorGenerator());
registerGenerator(new VSCodeGenerator());
registerGenerator(new ClaudeCodeGenerator());
registerGenerator(new GrokGenerator());
