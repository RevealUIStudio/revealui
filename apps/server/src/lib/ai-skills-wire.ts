/**
 * GAP-406 WIRE phase 4 — opt-in `@revealui/ai/skills` mount for apps/server.
 *
 * `REVEALUI_AI_SKILLS=1` (or true/yes/on): builds an {@link AgentSkillProvider}
 * over the process {@link globalSkillRegistry} for agent runtime injection.
 * Default (unset): null — no skills import cost when disabled.
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-406
 */

import type { AgentSkillProvider } from '@revealui/ai/skills';
import { createAgentSkillProvider, globalSkillRegistry, SkillActivator } from '@revealui/ai/skills';
import { logger } from '@revealui/core/observability/logger';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAiSkillsWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_AI_SKILLS?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

/**
 * Build a skill provider when enabled. Returns null when off.
 */
export function createSkillProviderIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): AgentSkillProvider | null {
  if (!isAiSkillsWireEnabled(env)) {
    return null;
  }

  const activator = new SkillActivator({ registry: globalSkillRegistry });
  const provider = createAgentSkillProvider(activator);
  logger.info('[ai-skills-wire] GAP-406 phase 4: AgentSkillProvider ready (global registry)');
  return provider;
}
