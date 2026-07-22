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

import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';
import { MANAGER_CONTENT_OUTPUT } from './types.js';

const CONTENT = MANAGER_CONTENT_OUTPUT;

function yamlEscape(value: string): string {
  if (/[:#\n"'{}[\],&*?|>!%@`]/.test(value) || value.trim() !== value) {
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
  readonly outputDir = CONTENT;

  generateRule(rule: Rule, _ctx: ResolverContext): GeneratedFile[] {
    return [
      {
        relativePath: `${CONTENT}/rules/${rule.id}.md`,
        content: ensureNl(rule.content),
      },
    ];
  }

  generateCommand(cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = ['---', `description: ${yamlEscape(cmd.description)}`];
    if (cmd.argumentHint) frontmatter.push(`argument-hint: ${yamlEscape(cmd.argumentHint)}`);
    if (cmd.disableModelInvocation) frontmatter.push('disable-model-invocation: true');
    frontmatter.push('---');
    return [
      {
        relativePath: `${CONTENT}/commands/${cmd.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(cmd.content)}`,
      },
    ];
  }

  generateAgent(agent: Agent, _ctx: ResolverContext): GeneratedFile[] {
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
        relativePath: `${CONTENT}/agents/${agent.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(agent.content)}`,
      },
    ];
  }

  generateSkill(skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    if (skill.skipFrontmatter) {
      return [
        {
          relativePath: `${CONTENT}/skills/${skill.id}/SKILL.md`,
          content: ensureNl(skill.content),
        },
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
        relativePath: `${CONTENT}/skills/${skill.id}/SKILL.md`,
        content: `${frontmatter.join('\n')}\n\n${ensureNl(skill.content)}`,
      },
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
    return files;
  }
}
