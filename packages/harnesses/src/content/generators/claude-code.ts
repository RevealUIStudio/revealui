/**
 * Claude Code / manager content generator (GAP-406)
 *
 * Primary emit lands under the **project manager** tree:
 *   `.revealui/content/{rules,commands,agents,skills}/`
 *
 * Vendor homes (`.claude`, `.cursor`, …) are **equal-rank adapters**.
 * Thin stubs that *reference* the manager are produced by
 * `revealui-harnesses manager materialize` — not by forking policy here.
 *
 * Package definitions in `@revealui/harnesses` remain build-time SSOT.
 */

import { contentRootRelative, loadManager } from '../../manager/paths.js';
import { RelativeManagerPathSchema } from '../../manager/schema.js';
import { resolveTemplate } from '../resolvers/index.js';
import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';
import { MANAGER_CONTENT_OUTPUT } from './types.js';

function contentOutput(ctx: ResolverContext): string {
  return contentRootRelative(loadManager(ctx.projectRoot));
}

// Characters that force a YAML scalar to be quoted (fleet no-regex hardline:
// Set membership over a character class, per .claude/rules/no-regex.md).
const YAML_QUOTING_CHARS = new Set([
  ':',
  '#',
  '\n',
  '\r', // bare CR is a YAML break character; unquoted it can split the scalar

  '"',
  "'",
  '{',
  '}',
  '[',
  ']',
  ',',
  '&',
  '*',
  '?',
  '|',
  '>',
  '!',
  '%',
  '@',
  '`',
]);

function needsYamlQuoting(value: string): boolean {
  if (value.trim() !== value) return true;
  for (const char of value) {
    if (YAML_QUOTING_CHARS.has(char)) return true;
  }
  return false;
}

function yamlEscape(value: string): string {
  if (needsYamlQuoting(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function ensureNl(body: string): string {
  return body.endsWith('\n') ? body : `${body}\n`;
}

export class ClaudeCodeGenerator implements ContentGenerator {
  readonly id = 'claude-code';
  /** Manager content root — not a vendor-private tree. */
  readonly outputDir = MANAGER_CONTENT_OUTPUT;

  generateRule(rule: Rule, ctx: ResolverContext): GeneratedFile[] {
    return [
      {
        relativePath: `${contentOutput(ctx)}/rules/${rule.id}.md`,
        content: ensureNl(rule.content),
      },
    ];
  }

  generateCommand(cmd: Command, ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = ['---', `description: ${yamlEscape(cmd.description)}`];
    if (cmd.argumentHint) frontmatter.push(`argument-hint: ${yamlEscape(cmd.argumentHint)}`);
    if (cmd.disableModelInvocation) frontmatter.push('disable-model-invocation: true');
    frontmatter.push('---');
    return [
      {
        relativePath: `${contentOutput(ctx)}/commands/${cmd.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(cmd.content)}`,
      },
    ];
  }

  generateAgent(agent: Agent, ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = [
      '---',
      `name: ${yamlEscape(agent.name)}`,
      `description: ${yamlEscape(agent.description)}`,
    ];
    if (agent.tools.length > 0) {
      frontmatter.push(`tools: ${agent.tools.join(', ')}`);
    }
    frontmatter.push('---');
    return [
      {
        relativePath: `${contentOutput(ctx)}/agents/${agent.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(agent.content)}`,
      },
    ];
  }

  generateSkill(skill: Skill, ctx: ResolverContext): GeneratedFile[] {
    const directory = `${contentOutput(ctx)}/skills/${RelativeManagerPathSchema.parse(skill.id)}`;
    const references = Object.entries(skill.references).map(([path, content]) => ({
      relativePath: `${directory}/${RelativeManagerPathSchema.parse(path)}`,
      content: ensureNl(content),
    }));
    if (skill.skipFrontmatter) {
      return [
        {
          relativePath: `${directory}/SKILL.md`,
          content: ensureNl(skill.content),
        },
        ...references,
      ];
    }
    const frontmatter = [
      '---',
      `name: ${yamlEscape(skill.name)}`,
      `description: ${yamlEscape(skill.description)}`,
    ];
    if (skill.disableModelInvocation) frontmatter.push('disable-model-invocation: true');
    frontmatter.push('---');
    return [
      {
        relativePath: `${directory}/SKILL.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(skill.content)}`,
      },
      ...references,
    ];
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
    return files.map((file) => ({
      ...file,
      content: resolveTemplate(file.content, ctx),
    }));
  }
}
