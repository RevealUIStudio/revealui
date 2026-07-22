/**
 * Claude Code Content Generator
 *
 * Emits adapter trees from canonical harness content definitions so Claude
 * Code is a *consumer*, not a second authoring home (GAP-406 / ADR 2026-07-21).
 *
 * Surfaces (Claude Code project layout):
 *   - rules:    `.claude/rules/<id>.md`
 *   - commands: `.claude/commands/<id>.md`  (slash commands; YAML frontmatter)
 *   - agents:   `.claude/agents/<id>.md`
 *   - skills:   `.claude/skills/<id>/SKILL.md`
 *
 * Hooks and settings.json are out of scope here — they remain machine-global
 * adapter config (claude-config) or protocol normalizers, same split as
 * Cursor's hooks-only generator vs MCP config normalizer.
 */

import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

function yamlEscape(value: string): string {
  // Keep frontmatter simple: quote when special chars present
  if (/[:#\n"'{}[\],&*?|>!%@`]/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

export class ClaudeCodeGenerator implements ContentGenerator {
  readonly id = 'claude-code';
  readonly outputDir = '.claude';

  generateRule(rule: Rule, _ctx: ResolverContext): GeneratedFile[] {
    // Rule content is already full markdown (definitions own the heading).
    const body = rule.content.endsWith('\n') ? rule.content : `${rule.content}\n`;
    return [
      {
        relativePath: `.claude/rules/${rule.id}.md`,
        content: body,
      },
    ];
  }

  generateCommand(cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = ['---', `description: ${yamlEscape(cmd.description)}`];
    if (cmd.argumentHint) frontmatter.push(`argument-hint: ${yamlEscape(cmd.argumentHint)}`);
    if (cmd.disableModelInvocation) frontmatter.push('disable-model-invocation: true');
    frontmatter.push('---');
    const body = cmd.content.endsWith('\n') ? cmd.content : `${cmd.content}\n`;
    return [
      {
        relativePath: `.claude/commands/${cmd.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${body}`,
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
    const body = agent.content.endsWith('\n') ? agent.content : `${agent.content}\n`;
    return [
      {
        relativePath: `.claude/agents/${agent.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${body}`,
      },
    ];
  }

  generateSkill(skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    if (skill.skipFrontmatter) {
      const body = skill.content.endsWith('\n') ? skill.content : `${skill.content}\n`;
      return [
        {
          relativePath: `.claude/skills/${skill.id}/SKILL.md`,
          content: body,
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
    const body = skill.content.endsWith('\n') ? skill.content : `${skill.content}\n`;
    return [
      {
        relativePath: `.claude/skills/${skill.id}/SKILL.md`,
        content: `${frontmatter.join('\n')}\n\n${body}`,
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
