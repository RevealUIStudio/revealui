import { resolveTemplate } from '../resolvers/index.js';
import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

/** Build YAML frontmatter from key-value pairs. Only includes defined values. */
function buildFrontmatter(fields: Record<string, string | boolean | undefined>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (value.includes('\n')) {
      lines.push(`${key}: |`);
      for (const line of value.split('\n')) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

export class ClaudeCodeGenerator implements ContentGenerator {
  readonly id = 'claude-code';
  readonly outputDir = '.claude';

  generateRule(rule: Rule, ctx: ResolverContext): GeneratedFile[] {
    const content = resolveTemplate(rule.content, ctx);
    return [
      {
        relativePath: `.claude/rules/${rule.id}.md`,
        content: `${content}\n`,
      },
    ];
  }

  generateCommand(cmd: Command, ctx: ResolverContext): GeneratedFile[] {
    const content = resolveTemplate(cmd.content, ctx);
    const frontmatter = buildFrontmatter({
      description: cmd.description,
      'disable-model-invocation': cmd.disableModelInvocation || undefined,
      'argument-hint': cmd.argumentHint,
    });
    return [
      {
        relativePath: `.claude/commands/${cmd.id}.md`,
        content: `${frontmatter}\n\n${content}\n`,
      },
    ];
  }

  generateAgent(agent: Agent, ctx: ResolverContext): GeneratedFile[] {
    const content = resolveTemplate(agent.content, ctx);
    const frontmatter = buildFrontmatter({
      name: agent.id,
      description: agent.description,
      isolation: agent.isolation === 'none' ? undefined : agent.isolation,
    });
    return [
      {
        relativePath: `.claude/agents/${agent.id}.md`,
        content: `${frontmatter}\n\n${content}\n`,
      },
    ];
  }

  generateSkill(skill: Skill, ctx: ResolverContext): GeneratedFile[] {
    const content = resolveTemplate(skill.content, ctx);
    const files: GeneratedFile[] = [];

    if (skill.skipFrontmatter) {
      files.push({
        relativePath: `.claude/skills/${skill.id}/SKILL.md`,
        content: `${content}\n`,
      });
    } else {
      const frontmatter = buildFrontmatter({
        name: skill.id,
        description: skill.description,
        'disable-model-invocation': skill.disableModelInvocation || undefined,
      });

      files.push({
        relativePath: `.claude/skills/${skill.id}/SKILL.md`,
        content: `${frontmatter}\n\n${content}\n`,
      });
    }

    for (const [name, refContent] of Object.entries(skill.references)) {
      files.push({
        relativePath: `.claude/skills/${skill.id}/references/${name}.md`,
        content: `${resolveTemplate(refContent, ctx)}\n`,
      });
    }

    return files;
  }

  generateAll(manifest: Manifest, ctx: ResolverContext): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    for (const rule of manifest.rules) {
      files.push(...this.generateRule(rule, ctx));
    }
    for (const cmd of manifest.commands) {
      files.push(...this.generateCommand(cmd, ctx));
    }
    for (const agent of manifest.agents) {
      files.push(...this.generateAgent(agent, ctx));
    }
    for (const skill of manifest.skills) {
      files.push(...this.generateSkill(skill, ctx));
    }

    return files;
  }
}
