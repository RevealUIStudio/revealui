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

/**
 * OpenAI-compat completion text. US-origin snaps (nemotron-3-nano) put
 * tokens in `reasoning_content` and leave `content` empty.
 */
export function extractSkillInvokeText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const first = choices[0];
  if (!first || typeof first !== 'object') return '';
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return '';
  const rec = message as { content?: unknown; reasoning_content?: unknown };
  const content = typeof rec.content === 'string' ? rec.content.trim() : '';
  if (content.length > 0) return rec.content as string;
  const reasoning = typeof rec.reasoning_content === 'string' ? rec.reasoning_content.trim() : '';
  if (reasoning.length > 0) return rec.reasoning_content as string;
  return '';
}

/** Measured ~1058ms/token prompt on nemotron-3-nano 30B Q4 CPU. */
export const SKILL_INVOKE_MS_PER_PROMPT_TOKEN = 1_200;
export const SKILL_INVOKE_DECODE_BUDGET_MS = 180_000;
export const SKILL_INVOKE_MIN_TIMEOUT_MS = 300_000;
export const SKILL_INVOKE_MAX_TIMEOUT_MS = 14_400_000;

export function parseSkillInvokeTimeoutOverride(raw: string | undefined): number | null {
  if (!raw || raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Wall-clock budget from prompt size so a 120s cap cannot kill a CPU snap. */
export function skillInvokeTimeoutMs(
  system: string,
  user: string,
  overrideMs?: number | null,
): number {
  if (overrideMs !== undefined && overrideMs !== null) {
    if (overrideMs > 0) return overrideMs;
  }
  const approxTokens = Math.max(1, Math.ceil((system.length + user.length) / 4));
  const sized = approxTokens * SKILL_INVOKE_MS_PER_PROMPT_TOKEN + SKILL_INVOKE_DECODE_BUDGET_MS;
  return Math.min(SKILL_INVOKE_MAX_TIMEOUT_MS, Math.max(SKILL_INVOKE_MIN_TIMEOUT_MS, sized));
}

export type SkillInvokeFailureKind = 'timeout' | 'connect' | 'other';

export function classifySkillInvokeFailure(err: unknown): SkillInvokeFailureKind {
  if (!(err instanceof Error)) return 'other';
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timeout';
  const msg = err.message;
  if (/aborted due to timeout|The operation was aborted/i.test(msg)) return 'timeout';
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|Failed to parse URL/i.test(msg)) {
    return 'connect';
  }
  return 'other';
}
