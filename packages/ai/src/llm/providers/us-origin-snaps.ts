/**
 * US-origin Inference Snap allowlist (product hardline).
 *
 * Canonical's snap catalog includes PRC-origin models (DeepSeek, Qwen, GLM).
 * RevealUI product local inference is **US-origin weights only**, fail-closed.
 *
 * Definition: open weights published by an organization whose ultimate parent
 * is incorporated in the United States. Packaging (Canonical snaps) is not origin.
 *
 * Allowlist today (Canonical catalog, 2026-08):
 *   - nemotron-3-nano / nemotron-3-nano-omni — NVIDIA
 *   - gemma3 / gemma4 — Google (Alphabet)
 *
 * Escape (operator-only, never seed, always loud in the error path):
 *   REVEALUI_ALLOW_NON_US_MODELS=1
 *
 * Companion ADR: .jv docs/decisions/2026-07-24-us-origin-inference-snaps.md
 *
 * Weight-file fetches (URL + sha256, pickle refuse) live in
 * `../artifact-provenance.ts` (GAP-484). Snap ids and the local Ollama chat
 * allowlist both live in this module.
 */

/**
 * Product install/list catalog (snap name + operator-facing description).
 * SSOT for harnesses InferenceService + Studio install UIs.
 * Order: product default first. Canonical marks only gemma3 as WSL-supported
 * (https://documentation.ubuntu.com/inference-snaps/reference/snaps/).
 * Nemotron stays allowlisted for capable hosts.
 */
export const PRODUCT_INFERENCE_SNAP_CATALOG = [
  {
    id: 'gemma3',
    description: 'Google (US) — product default; 270m fits 4GB WSL',
  },
  {
    id: 'gemma4',
    description: 'Google (US) — general + vision + tools',
  },
  {
    id: 'nemotron-3-nano',
    description: 'NVIDIA (US) — heavy / capable hosts (set LLM_MODEL=nemotron-3-nano)',
  },
  {
    id: 'nemotron-3-nano-omni',
    description: 'NVIDIA (US) — multimodal (text/image/video/audio in)',
  },
] as const;

export type UsOriginInferenceSnapId = (typeof PRODUCT_INFERENCE_SNAP_CATALOG)[number]['id'];

/** Snap model IDs permitted for product Inference Snaps usage. */
export const US_ORIGIN_INFERENCE_SNAP_IDS: readonly UsOriginInferenceSnapId[] =
  PRODUCT_INFERENCE_SNAP_CATALOG.map((entry) => entry.id);

/** Default chat/embed model when none is specified (env factory / provider). */
export const DEFAULT_US_ORIGIN_INFERENCE_SNAP: UsOriginInferenceSnapId = 'gemma3';

/** Preferred snap on constrained hosts (profile `snaps` tier). */
export const DEFAULT_LOW_RAM_INFERENCE_SNAP: UsOriginInferenceSnapId = 'gemma3';

/**
 * Preferred Ollama chat model for profile `daily` tier and bare Ollama defaults.
 * Gemma 4 E2B is the smallest Gemma 4 tag the Ollama library publishes
 * (https://ollama.com/library/gemma4). Edge and small local hosts use it first.
 * Unlisted ids are refused by `resolveApprovedLocalModel`.
 */
export const DEFAULT_DAILY_OLLAMA_MODEL = 'gemma4:e2b';

/**
 * US open-weight families allowed for local Ollama chat.
 * Match is a family prefix plus a boundary (end, digit, or `: - . /`).
 * Anything else is refused. There is no denylist.
 */
export const APPROVED_LOCAL_MODEL_FAMILIES = [
  'gemma',
  'llama',
  'gpt-oss',
  'phi',
  'olmo',
  'granite',
] as const;

export type ApprovedLocalModelFamily = (typeof APPROVED_LOCAL_MODEL_FAMILIES)[number];

const LOCAL_MODEL_FAMILY_BOUNDARIES = new Set([':', '-', '.', '/']);

export class UnapprovedLocalModelError extends Error {
  readonly code = 'UNAPPROVED_LOCAL_MODEL' as const;
  readonly modelId: string;

  constructor(modelId: string) {
    super(
      `Local model "${modelId}" is not on the US open-weight allowlist ` +
        `(${APPROVED_LOCAL_MODEL_FAMILIES.join(', ')}). ` +
        `Set LLM_MODEL to an approved local tag (default ${DEFAULT_DAILY_OLLAMA_MODEL}).`,
    );
    this.name = 'UnapprovedLocalModelError';
    this.modelId = modelId;
  }
}

function isLocalModelFamilyBoundary(char: string | undefined): boolean {
  if (char === undefined) return true;
  if (char >= '0' && char <= '9') return true;
  return LOCAL_MODEL_FAMILY_BOUNDARIES.has(char);
}

/** True when `modelId` belongs to an approved local Ollama family. */
export function isApprovedLocalModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (id.length === 0) return false;
  const families = [...APPROVED_LOCAL_MODEL_FAMILIES].sort((a, b) => b.length - a.length);
  for (const family of families) {
    if (!id.startsWith(family)) continue;
    if (isLocalModelFamilyBoundary(id[family.length])) return true;
  }
  return false;
}

/**
 * Resolve the local Ollama chat model.
 *
 * Empty or omitted input uses `DEFAULT_DAILY_OLLAMA_MODEL`.
 * @throws {UnapprovedLocalModelError} when the resolved id is off the allowlist
 */
export function resolveApprovedLocalModel(modelId: string | undefined): string {
  const resolved =
    modelId !== undefined && modelId.trim() !== '' ? modelId.trim() : DEFAULT_DAILY_OLLAMA_MODEL;
  if (!isApprovedLocalModel(resolved)) {
    throw new UnapprovedLocalModelError(resolved);
  }
  return resolved;
}

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

/**
 * True when the model id is on the US-origin product allowlist.
 *
 * Accepts exact snap ids (`nemotron-3-nano`) and engine-served variants that
 * Canonical publishes under the same snap (e.g.
 * `nemotron-3-nano-30b-a3b-q4-k-m`, `gemma4:e2b` style suffixes with `-` or `:`).
 * Match longest snap id first so `nemotron-3-nano-omni` wins over `nemotron-3-nano`.
 */
export function isUsOriginInferenceSnap(modelId: string): boolean {
  const id = normalizeInferenceSnapModelId(modelId);
  const snaps = [...US_ORIGIN_INFERENCE_SNAP_IDS].sort((a, b) => b.length - a.length);
  for (const snap of snaps) {
    if (id === snap) return true;
    if (id.startsWith(`${snap}-`) || id.startsWith(`${snap}:`)) return true;
  }
  return false;
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
