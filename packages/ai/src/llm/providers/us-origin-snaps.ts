/**
 * US-origin Inference Snap allowlist (product hardline).
 *
 * Canonical's snap catalog includes PRC-origin models (DeepSeek, Qwen, GLM).
 * RevealUI product local inference is **US-origin weights only**, fail-closed.
 *
 * Definition: open weights published by an organization whose ultimate parent
 * is incorporated in the United States. Packaging (Canonical snaps) is not origin.
 *
 * Allowlist today (Canonical catalog, 2026-07):
 *   - nemotron-3-nano / nemotron-3-nano-omni — NVIDIA
 *   - gemma3 / gemma4 — Google (Alphabet)
 *
 * Escape (operator-only, never seed, always loud in the error path):
 *   REVEALUI_ALLOW_NON_US_MODELS=1
 *
 * Companion ADR: .jv docs/decisions/2026-07-24-us-origin-inference-snaps.md
 */

/** Snap model IDs permitted for product Inference Snaps usage. */
export const US_ORIGIN_INFERENCE_SNAP_IDS = [
  'nemotron-3-nano',
  'nemotron-3-nano-omni',
  'gemma3',
  'gemma4',
] as const;

export type UsOriginInferenceSnapId = (typeof US_ORIGIN_INFERENCE_SNAP_IDS)[number];

/** Default chat/embed model when none is specified. */
export const DEFAULT_US_ORIGIN_INFERENCE_SNAP: UsOriginInferenceSnapId = 'nemotron-3-nano';

/** Operator escape env var. Never set in customer seed or CI green paths. */
export const NON_US_MODELS_ESCAPE_ENV = 'REVEALUI_ALLOW_NON_US_MODELS';

export class NonUsOriginInferenceSnapError extends Error {
  readonly code = 'NON_US_ORIGIN_INFERENCE_SNAP' as const;
  readonly modelId: string;

  constructor(modelId: string) {
    super(
      `Inference Snap model "${modelId}" is not on the US-origin allowlist ` +
        `(${US_ORIGIN_INFERENCE_SNAP_IDS.join(', ')}). ` +
        'Product local inference is US-origin snaps only. ' +
        `Install: sudo snap install ${DEFAULT_US_ORIGIN_INFERENCE_SNAP}. ` +
        `Operator escape (audited, never seed): ${NON_US_MODELS_ESCAPE_ENV}=1`,
    );
    this.name = 'NonUsOriginInferenceSnapError';
    this.modelId = modelId;
  }
}

/** Normalize a snap model id for allowlist comparison. */
export function normalizeInferenceSnapModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

/** True when the model id is on the US-origin product allowlist. */
export function isUsOriginInferenceSnap(modelId: string): boolean {
  const id = normalizeInferenceSnapModelId(modelId);
  return (US_ORIGIN_INFERENCE_SNAP_IDS as readonly string[]).includes(id);
}

/** True when the operator escape hatch is enabled. */
export function isNonUsModelsEscapeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[NON_US_MODELS_ESCAPE_ENV];
  return value === '1' || value === 'true';
}

export interface AssertUsOriginInferenceSnapOptions {
  /** Force-allow non-US models (tests / explicit callers). Overrides env when true. */
  allowNonUs?: boolean;
  /** Env source for the escape hatch (defaults to process.env). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Resolve and enforce the US-origin allowlist.
 *
 * @returns the model id to use (default when empty/undefined)
 * @throws {NonUsOriginInferenceSnapError} when model is off-allowlist and escape is off
 */
export function assertUsOriginInferenceSnap(
  modelId: string | undefined,
  options?: AssertUsOriginInferenceSnapOptions,
): string {
  const resolved =
    modelId !== undefined && modelId.trim() !== ''
      ? modelId.trim()
      : DEFAULT_US_ORIGIN_INFERENCE_SNAP;

  const allowNonUs =
    options?.allowNonUs === true || isNonUsModelsEscapeEnabled(options?.env ?? process.env);

  if (!(allowNonUs || isUsOriginInferenceSnap(resolved))) {
    throw new NonUsOriginInferenceSnapError(resolved);
  }

  return resolved;
}
