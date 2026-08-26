/**
 * Grok content generator (control-layer phase 2).
 *
 * Grok auto-loads `<repo>/.grok/rules/*.md` and does not scan
 * `.revealui/content/`. Until this generator existed, Studio Grok ingested
 * the Claude vendor tree via `[compat.claude] rules = true` (~38k tokens in
 * the monorepo). That dump cannot run on local/open models and fights the
 * native ACP agent's 4k-char cap.
 *
 * Emit:
 * - preamble tier 1 (always-on constitution) → `.grok/rules/<id>.md`
 * - remaining definition rules → `.grok/skills/rule-<id>/SKILL.md` (on demand)
 * - content agents → `.grok/agents/<id>.md`
 * - spawn map (Grok TUI types → content agents) → `.grok/rules/00-spawn-map.md`
 * - adapter orientation → `.grok/rules/00-revealui-manager.md` (public-safe;
 *   `$HOME/.grok` is a vendor cache, not constitution)
 *
 * Hand-authored Grok-only files (e.g. `.grok/rules/project-layout.md`) are
 * not definition ids and are left alone. Do not name a Grok-only file after
 * a definition rule id.
 */

import { alwaysOnRuleIds } from '../preamble-ids.js';
import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

export const GROK_OUTPUT_DIR = '.grok';
export const GROK_SPAWN_MAP_PATH = '.grok/rules/00-spawn-map.md';
/** Always-on adapter orientation (not a definition id; public-safe). */
export const GROK_MANAGER_RULE_PATH = '.grok/rules/00-revealui-manager.md';

const YAML_QUOTING_CHARS = new Set([
  ':',
  '#',
  '\n',
  '\r',
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

/** Grok TUI spawn_subagent types → control-layer content agent ids. */
export const GROK_SPAWN_MAP: ReadonlyArray<{
  grokType: string;
  contentAgent: string | null;
  when: string;
}> = [
  { grokType: 'explore', contentAgent: null, when: 'read-only codebase search (builtin)' },
  { grokType: 'plan', contentAgent: null, when: 'implementation plans (builtin)' },
  { grokType: 'implementer', contentAgent: 'builder', when: 'specced feature or bug work' },
  { grokType: 'reviewer', contentAgent: 'security-reviewer', when: 'PR / code / security review' },
  { grokType: 'mechanic', contentAgent: 'linter', when: 'renames, mechanical sweeps' },
  {
    grokType: 'senior-architect',
    contentAgent: null,
    when: 'design, ADRs, multi-system trade-offs',
  },
];

export function grokRulePathForDefinitionId(ruleId: string): string {
  return `${GROK_OUTPUT_DIR}/rules/${ruleId}.md`;
}

export function grokOnDemandSkillPath(ruleId: string): string {
  return `${GROK_OUTPUT_DIR}/skills/rule-${ruleId}/SKILL.md`;
}

export function grokAgentPath(agentId: string): string {
  return `${GROK_OUTPUT_DIR}/agents/${agentId}.md`;
}

function spawnMapMarkdown(): string {
  const rows = GROK_SPAWN_MAP.map((row) => {
    const content = row.contentAgent ? `\`${row.contentAgent}\`` : '(builtin / home)';
    return `| \`${row.grokType}\` | ${content} | ${row.when} |`;
  }).join('\n');
  return `# Grok spawn types → control-layer agents

Grok TUI \`spawn_subagent\` types are the wire contract. Content agents in
\`.revealui/content/agents/\` (and this tree's \`.grok/agents/\`) are the policy
SSOT. Prefer one well-scoped subagent (token economy).

| Grok type | Content agent | When |
|-----------|---------------|------|
${rows}

When spawning \`implementer\`, \`reviewer\`, or \`mechanic\`, follow the matching
content agent prompt. Project agents (\`builder\`, \`tester\`, \`linter\`,
\`security-reviewer\`, \`gate-runner\`, \`docs-sync\`) are also valid spawn names
when Grok discovers them under \`.grok/agents/\`.

Do not invent a second taxonomy under \`~/.grok/agents/\`.
`;
}

function managerOrientationMarkdown(): string {
  return `# RevealUI manager (Grok load path)

Grok loads this tree because cwd is the product. \`$HOME/.grok\` is a vendor
cache (auth, sessions, UI, hooks). Do not author policy there.

1. \`.revealui/manager.json\` then \`.revealui/content/\` (SSOT)
2. TRACKER from \`tracker.path\` on the manager
3. Product I/O via RevealUI MCP (\`rfg\`). Secrets via revvault
4. Keep \`[compat.claude] rules = false\`. Do not ingest the Claude vendor dump

Mechanical deny is PreToolUse (RevKit deploys hook JSON from this repo).
Git identity is \`git config user.email\` (RevKit identity.gitconfig), not this file.

Do not invent parallel queues under \`$HOME/.grok\`.
`;
}

export class GrokGenerator implements ContentGenerator {
  readonly id = 'grok';
  readonly outputDir = GROK_OUTPUT_DIR;

  generateRule(rule: Rule, _ctx: ResolverContext): GeneratedFile[] {
    if (rule.preambleTier === 1) {
      return [
        {
          relativePath: grokRulePathForDefinitionId(rule.id),
          content: ensureNl(rule.content),
        },
      ];
    }
    return [this.onDemandSkillFile(rule)];
  }

  generateCommand(_cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAgent(agent: Agent, _ctx: ResolverContext): GeneratedFile[] {
    const frontmatter = [
      '---',
      `name: ${yamlEscape(agent.id)}`,
      `description: ${yamlEscape(agent.description)}`,
      'prompt_mode: full',
      'agents_md: false',
    ];
    frontmatter.push('---');
    return [
      {
        relativePath: grokAgentPath(agent.id),
        content: `${frontmatter.join('\n')}\n\n${ensureNl(agent.content)}`,
      },
    ];
  }

  generateSkill(_skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    // Skills already live under `.agents/skills/` and `.revealui/content/skills/`.
    // Re-emitting them here duplicates the catalog (100+ collisions).
    return [];
  }

  generateAll(manifest: Manifest, ctx: ResolverContext): GeneratedFile[] {
    const alwaysOn = alwaysOnRuleIds(manifest);
    const files: GeneratedFile[] = [
      { relativePath: GROK_SPAWN_MAP_PATH, content: ensureNl(spawnMapMarkdown()) },
      { relativePath: GROK_MANAGER_RULE_PATH, content: ensureNl(managerOrientationMarkdown()) },
    ];
    for (const rule of manifest.rules) {
      if (alwaysOn.has(rule.id)) {
        files.push({
          relativePath: grokRulePathForDefinitionId(rule.id),
          content: ensureNl(rule.content),
        });
      } else {
        files.push(this.onDemandSkillFile(rule));
      }
    }
    for (const agent of manifest.agents) {
      files.push(...this.generateAgent(agent, ctx));
    }
    return files;
  }

  private onDemandSkillFile(rule: Rule): GeneratedFile {
    const frontmatter = [
      '---',
      `name: ${yamlEscape(`rule-${rule.id}`)}`,
      `description: ${yamlEscape(rule.description)}`,
      '---',
    ];
    return {
      relativePath: grokOnDemandSkillPath(rule.id),
      content: `${frontmatter.join('\n')}\n\n${ensureNl(rule.content)}`,
    };
  }
}
