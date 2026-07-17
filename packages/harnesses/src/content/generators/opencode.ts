/**
 * OpenCode Content Generator
 *
 * Renders the canonical content definitions (rules, commands, agents, skills)
 * into OpenCode-native output. OpenCode's documented writable surfaces
 * (audited 2026-07-16) are narrower than Claude Code's:
 *   - agents: markdown + frontmatter under `.opencode/agents/<id>.md`
 *   - commands: markdown + frontmatter under `.opencode/commands/<id>.md`
 *   - AGENTS.md at the project root (natively read by OpenCode)
 *
 * There is no documented native surface for standalone rule or skill files.
 * AGENTS.md is already emitted by the separate, existing
 * `protocolConfigToAgentsMd` generator (`../../protocol/config-normalizer.ts`,
 * operating over `ProtocolConfig` rather than the `Manifest` this generator
 * consumes) -- this generator does not duplicate that output. Skills reach
 * OpenCode only through its `CLAUDE.md` / `~/.claude/skills/` fallback (a
 * read of ANOTHER tool's files), which this generator does not own.
 * `generateRule`/`generateSkill` therefore return no files -- a scoping
 * decision, not an oversight. Revisit if OpenCode ships a documented native
 * rules/skills directory.
 */

import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

export class OpenCodeGenerator implements ContentGenerator {
  readonly id = 'opencode';
  readonly outputDir = '.opencode';

  generateRule(_rule: Rule, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateCommand(cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = ['---', `description: ${cmd.description}`];
    if (cmd.argumentHint) frontmatter.push(`argument-hint: ${cmd.argumentHint}`);
    if (cmd.disableModelInvocation) frontmatter.push('disable-model-invocation: true');
    frontmatter.push('---');

    return [
      {
        relativePath: `.opencode/commands/${cmd.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${cmd.content}\n`,
      },
    ];
  }

  generateAgent(agent: Agent, _ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = ['---', `description: ${agent.description}`];
    if (agent.tools.length > 0) frontmatter.push(`tools: ${agent.tools.join(', ')}`);
    frontmatter.push('---');

    return [
      {
        relativePath: `.opencode/agents/${agent.id}.md`,
        content: `${frontmatter.join('\n')}\n\n${agent.content}\n`,
      },
    ];
  }

  generateSkill(_skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAll(manifest: Manifest, ctx: ResolverContext): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    for (const cmd of manifest.commands) {
      files.push(...this.generateCommand(cmd, ctx));
    }
    for (const agent of manifest.agents) {
      files.push(...this.generateAgent(agent, ctx));
    }
    return files;
  }
}
