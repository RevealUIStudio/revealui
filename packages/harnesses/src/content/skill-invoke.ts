/**
 * GAP-293 Phase C — bind native workflow skills to the product default snap.
 *
 * Snap is not invented: `nemotron-3-nano` is DEFAULT_US_ORIGIN_INFERENCE_SNAP
 * in `@revealui/ai` (`providers/us-origin-snaps.ts`). This module only
 * prepares the invoke; it does not run tools or commit.
 */

import { readFileSync } from 'node:fs';
import type { SkillCatalogEntry } from './skill-catalog.js';

export const NATIVE_WORKFLOW_SKILL_IDS = [
  'revealui-doctor',
  'revealui-recover',
  'revealui-checkpoint',
] as const;

export type NativeWorkflowSkillId = (typeof NATIVE_WORKFLOW_SKILL_IDS)[number];

/** Product default Inference Snap (US-origin catalog). */
export const PHASE_C_INFERENCE_SNAP = 'nemotron-3-nano';

const ALIASES: Record<string, NativeWorkflowSkillId> = {
  doctor: 'revealui-doctor',
  recover: 'revealui-recover',
  checkpoint: 'revealui-checkpoint',
};

export function resolveNativeWorkflowSkillId(raw: string): NativeWorkflowSkillId | null {
  const key = raw.trim();
  if (key in ALIASES) return ALIASES[key] ?? null;
  for (const id of NATIVE_WORKFLOW_SKILL_IDS) {
    if (id === key) return id;
  }
  return null;
}

export function isNativeWorkflowSkillId(id: string): id is NativeWorkflowSkillId {
  return resolveNativeWorkflowSkillId(id) !== null;
}

export interface SkillInvokeRequest {
  skillId: NativeWorkflowSkillId;
  model: typeof PHASE_C_INFERENCE_SNAP;
  path: string;
  system: string;
  user: string;
}

export function buildSkillInvokeRequest(
  skillId: string,
  catalog: SkillCatalogEntry[],
): SkillInvokeRequest | { error: string } {
  const resolved = resolveNativeWorkflowSkillId(skillId);
  if (!resolved) {
    return {
      error: `skills.invoke allowlist is ${NATIVE_WORKFLOW_SKILL_IDS.join(', ')} (or doctor/recover/checkpoint). Got: ${skillId}`,
    };
  }
  const entry = catalog.find((s) => s.id === resolved);
  if (!entry) {
    return {
      error: `skill ${resolved} is not in the catalog (materialize content or set revskills root)`,
    };
  }
  let body: string;
  try {
    body = readFileSync(entry.path, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `cannot read ${entry.path}: ${msg}` };
  }
  return {
    skillId: resolved,
    model: PHASE_C_INFERENCE_SNAP,
    path: entry.path,
    system: body,
    user: [
      `Run the ${resolved} workflow as a RevDev-native pass.`,
      `Local model is the product default Inference Snap: ${PHASE_C_INFERENCE_SNAP}.`,
      'You cannot execute tools or git commits from this invoke.',
      'Produce the structured report the skill specifies (traffic-light / diagnostic / checkpoint report).',
      'Name any command you would have run; do not claim you ran it.',
    ].join(' '),
  };
}
