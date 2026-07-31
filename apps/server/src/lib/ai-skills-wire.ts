/**
 * GAP-406 WIRE phase 4 + GAP-411 residual — opt-in `@revealui/ai/skills` mount.
 *
 * `REVEALUI_AI_SKILLS=1` (or true/yes/on): builds an AgentSkillProvider over a
 * SkillRegistry loaded from disk catalog paths.
 * Default (unset): null — no skills load when disabled.
 *
 * Catalog paths (GAP-411 residual 2):
 * - `REVEALUI_AI_SKILLS_GLOBAL_DIR` — global skills dir (default `~/.revealui/skills`)
 * - `REVEALUI_AI_SKILLS_LOCAL_DIR` — project-relative dir (default `.revealui/skills`)
 * - `REVEALUI_AI_SKILLS_PROJECT_ROOT` — project root for local dir resolution
 * - `REVEALUI_AI_SKILLS_DIRS` — extra absolute/relative dirs (comma or colon separated)
 *
 * Pro package is loaded via dynamic import (boundary: optional Fair Source).
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-411
 */

import { logger } from '@revealui/core/observability/logger';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAiSkillsWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_AI_SKILLS?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

/**
 * Parse extra skill catalog directories from `REVEALUI_AI_SKILLS_DIRS`.
 * Comma-separated preferred. When no commas are present, also split on `:`
 * (POSIX path lists). Prefer commas for paths that contain colons.
 */
export function parseSkillCatalogDirs(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.REVEALUI_AI_SKILLS_DIRS?.trim();
  if (!raw) return [];
  const parts = raw.includes(',') ? raw.split(',') : raw.split(':');
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * Build a skill provider when enabled. Loads skills from configured catalog
 * dirs into a registry (not an empty process global). Returns null when off
 * or package missing.
 */
export async function createSkillProviderIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown | null> {
  if (!isAiSkillsWireEnabled(env)) {
    return null;
  }

  try {
    const skills = await import('@revealui/ai/skills');

    const globalDir = env.REVEALUI_AI_SKILLS_GLOBAL_DIR?.trim();
    const localDir = env.REVEALUI_AI_SKILLS_LOCAL_DIR?.trim();
    const projectRoot = env.REVEALUI_AI_SKILLS_PROJECT_ROOT?.trim();

    const registry = new skills.SkillRegistry({
      ...(globalDir ? { globalDir } : {}),
      ...(localDir ? { localDir } : {}),
      ...(projectRoot ? { projectRoot } : {}),
    });

    // Primary catalog: global + project-local install dirs.
    await registry.loadAllSkills(false);

    // Extra catalog dirs (operator-installed packs, monorepo skill libraries).
    const extraDirs = parseSkillCatalogDirs(env);
    for (const dir of extraDirs) {
      try {
        const loaded = await skills.loadAllFromDirectory(dir, {
          registry,
          scope: 'local',
        });
        logger.info('[ai-skills-wire] loaded skills from extra catalog dir', {
          dir,
          count: loaded.length,
        });
      } catch (error) {
        logger.warn('[ai-skills-wire] failed to load extra catalog dir', {
          dir,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const skillCount = registry.getAll().length;
    const activator = new skills.SkillActivator({ registry });
    const provider = skills.createAgentSkillProvider(activator);
    logger.info('[ai-skills-wire] GAP-411: AgentSkillProvider ready', {
      skillCount,
      extraDirs: extraDirs.length,
    });
    return provider;
  } catch (error) {
    logger.warn('[ai-skills-wire] failed to load @revealui/ai/skills', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
