import { resolveTemplate } from '../resolvers/index.js';
import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

/**
 * Cursor generator stub.
 *
 * Cursor uses `.cursor/rules/*.mdc` files with a simpler format.
 * Full implementation deferred — this produces basic `.mdc` output
 * for rules only. Commands, agents, and skills have no Cursor equivalent yet.
 */
export class CursorGenerator implements ContentGenerator {
  readonly id = 'cursor';
  readonly outputDir = '.cursor';

  generateRule(rule: Rule, ctx: ResolverContext): GeneratedFile[] {
    const content = resolveTemplate(rule.content, ctx);
    return [
      {
        relativePath: `.cursor/rules/${rule.id}.mdc`,
        content: `---\ndescription: ${rule.description}\n---\n\n${content}\n`,
      },
    ];
  }

  generateCommand(_cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAgent(_agent: Agent, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateSkill(_skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAll(manifest: Manifest, ctx: ResolverContext): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    for (const rule of manifest.rules) {
      files.push(...this.generateRule(rule, ctx));
    }
    return files;
  }
}
