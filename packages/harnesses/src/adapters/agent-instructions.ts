/**
 * System instructions for the RevealUI coding / headless agent.
 *
 * Default is slim: free-tier LLM APIs (e.g. Groq 12k TPM) cannot hold a full
 * monorepo `.claude/rules` dump (~60KB) plus tool schemas in one request.
 * Opt in to project rules with REVEALUI_AGENT_INCLUDE_RULES=1 (still capped).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Hard cap when rules are included (chars). ~2–3k tokens of rules max. */
export const DEFAULT_AGENT_RULES_MAX_CHARS = 4_000;

const BASE_INSTRUCTIONS = [
  'You are the RevealUI coding agent. You help with software development tasks in this project.',
  'Use the available tools to read, write, edit, search, and execute commands.',
  'Always read files before modifying them. Prefer surgical edits over full rewrites.',
  'Follow project conventions; use tools to inspect the repo instead of assuming large rule dumps.',
  'Keep tool results and replies concise. Prefer paths and diffs over pasting whole files.',
  '',
].join('\n');

export interface BuildAgentInstructionsOptions {
  projectRoot: string;
  /**
   * When true, append truncated `.claude/rules/*.md` content.
   * Default: false (env REVEALUI_AGENT_INCLUDE_RULES=1 enables).
   */
  includeRules?: boolean;
  /** Max characters of rules content after base instructions (default 4000). */
  maxRulesChars?: number;
}

/**
 * Whether to include project rules. Explicit option wins; else env.
 */
export function shouldIncludeAgentRules(includeRules?: boolean): boolean {
  if (includeRules !== undefined) {
    return includeRules;
  }
  const env = process.env.REVEALUI_AGENT_INCLUDE_RULES?.trim().toLowerCase();
  return env === '1' || env === 'true' || env === 'yes';
}

/**
 * Build system instructions for headless / ACP agent runs.
 */
export function buildAgentInstructions(options: BuildAgentInstructionsOptions): string {
  const includeRules = shouldIncludeAgentRules(options.includeRules);
  if (!includeRules) {
    return BASE_INSTRUCTIONS;
  }

  const maxRulesChars = options.maxRulesChars ?? DEFAULT_AGENT_RULES_MAX_CHARS;
  const parts: string[] = [BASE_INSTRUCTIONS, '## Project rules (truncated)', ''];
  let used = 0;

  try {
    const rulesDir = join(options.projectRoot, '.claude', 'rules');
    const ruleFiles = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    for (const file of ruleFiles) {
      if (used >= maxRulesChars) {
        break;
      }
      const content = readFileSync(join(rulesDir, file), 'utf8');
      const header = `### ${file.replace(/\.md$/, '')}\n`;
      const remaining = maxRulesChars - used;
      const body =
        content.length + header.length <= remaining
          ? content
          : `${content.slice(0, Math.max(0, remaining - header.length - 20))}\n…[truncated]`;
      const chunk = `${header}${body}\n\n`;
      parts.push(chunk);
      used += chunk.length;
    }

    if (used >= maxRulesChars) {
      parts.push(
        '(Further project rules omitted to stay within LLM context limits. Set a higher REVEALUI_AGENT_RULES_MAX_CHARS or use a higher-TPM provider for full rules.)\n',
      );
    }
  } catch {
    // No rules directory — base only
  }

  return parts.join('\n');
}
