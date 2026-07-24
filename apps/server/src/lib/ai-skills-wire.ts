/**
 * GAP-406 WIRE phase 4 — opt-in `@revealui/ai/skills` mount for apps/server.
 *
 * `REVEALUI_AI_SKILLS=1` (or true/yes/on): builds an AgentSkillProvider over the
 * process globalSkillRegistry for agent runtime injection.
 * Default (unset): null — no skills load when disabled.
 *
 * Pro package is loaded via dynamic import (boundary: optional Fair Source).
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-406
 */

import { logger } from '@revealui/core/observability/logger';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAiSkillsWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_AI_SKILLS?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

/**
 * Build a skill provider when enabled. Returns null when off or package missing.
 */
export async function createSkillProviderIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown | null> {
  if (!isAiSkillsWireEnabled(env)) {
    return null;
  }

  try {
    const skills = await import('@revealui/ai/skills');
    const activator = new skills.SkillActivator({ registry: skills.globalSkillRegistry });
    const provider = skills.createAgentSkillProvider(activator);
    logger.info('[ai-skills-wire] GAP-406 phase 4: AgentSkillProvider ready (global registry)');
    return provider;
  } catch (error) {
    logger.warn('[ai-skills-wire] failed to load @revealui/ai/skills', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
