/**
 * Hardware capability profiles (GAP-297).
 *
 * Named, extendable host tiers for local-inference vocabulary — distinct from
 * `local-ai-profile.ts` (operator runtime apply: idle/daily/snaps/heavy).
 *
 * Tiers (owner directive 2026-07-09):
 *   - constrained  — low-RAM WSL / no dedicated GPU (owner machine reference)
 *   - mainstream   — typical laptop/desktop with mid GPU or solid CPU RAM
 *   - workstation  — high-VRAM / high-RAM local inference host
 *
 * Zero required config: absent profile → resolve returns null (no behavior
 * change to the default dev path). GAP-296 boundary entries may cite `tier`
 * instead of repeating raw hardware specs.
 */

export type HardwareCapabilityTier = 'constrained' | 'mainstream' | 'workstation';

/** GAP-296-aligned verdict vocabulary for capability hints. */
export type CapabilityVerdict = 'local-OK' | 'primitives-only' | 'frontier-only';

export type CpuClass = 'low' | 'mid' | 'high';

export interface HardwareCapabilityProfile {
  /** Stable id (preset id or user override id). */
  id: string;
  /** One of the three shipping tiers. */
  tier: HardwareCapabilityTier;
  /** Short human description. */
  description: string;
  /** Minimum usable host RAM (GiB) for this tier. */
  ramGbMin: number;
  /** Typical host RAM (GiB) used in docs / boundary pins. */
  ramGbTypical: number;
  /** Minimum dedicated GPU VRAM (GiB). 0 = CPU-only / iGPU acceptable. */
  vramGbMin: number;
  cpuClass: CpuClass;
  /**
   * Inference Snap / Ollama size classes viable on this tier.
   * Values are size labels, not model names (model catalog churns faster).
   */
  viableModelSizes: Array<'nano' | 'small' | 'medium' | 'large'>;
  /**
   * Default expected verdicts for common capability classes.
   * Living evidence still lives in GAP-296; this is hardware vocabulary only.
   */
  capabilityHints: Partial<
    Record<
      | 'product-inference'
      | 'embeddings'
      | 'auto-classify'
      | 'security-design'
      | 'multi-repo-synthesis'
      | 'mechanical-build'
      | 'guardrail-verify'
      | 'reasoner-loop',
      CapabilityVerdict
    >
  >;
  /** Free-text operator note. */
  note?: string;
  /** When true, this profile is a user override of a preset (not a stock preset). */
  isOverride?: boolean;
  /** Preset id this override extends (if any). */
  extends?: HardwareCapabilityTier;
}

/** Stock preset ids == tier names for the three shipping tiers. */
export const HARDWARE_CAPABILITY_PRESET_IDS = [
  'constrained',
  'mainstream',
  'workstation',
] as const satisfies readonly HardwareCapabilityTier[];

/**
 * Constrained — owner WSL2 reference (~4–8 GiB usable, no dedicated GPU).
 * Aligns with system-tune wsl-low-ram and local-ai "heavy needs care" notes.
 */
export const CONSTRAINED_PRESET: HardwareCapabilityProfile = {
  id: 'constrained',
  tier: 'constrained',
  description:
    'Low-RAM self-host (WSL2 ~4–8 GiB usable, no dedicated GPU). Prefer nano/small models; unload after use.',
  ramGbMin: 4,
  ramGbTypical: 6,
  vramGbMin: 0,
  cpuClass: 'low',
  viableModelSizes: ['nano', 'small'],
  capabilityHints: {
    'product-inference': 'local-OK',
    embeddings: 'local-OK',
    'auto-classify': 'primitives-only',
    'security-design': 'frontier-only',
    'multi-repo-synthesis': 'frontier-only',
    'mechanical-build': 'local-OK',
    'guardrail-verify': 'frontier-only',
    'reasoner-loop': 'primitives-only',
  },
  note: 'Owner-machine reference tier (2026-07-09). Do not treat as a behavior change to unconfigured hosts.',
};

/** Mainstream — typical modern laptop/desktop. */
export const MAINSTREAM_PRESET: HardwareCapabilityProfile = {
  id: 'mainstream',
  tier: 'mainstream',
  description:
    'Typical dev laptop/desktop (16–32 GiB RAM, optional mid-tier GPU). Small/medium local models viable.',
  ramGbMin: 12,
  ramGbTypical: 16,
  vramGbMin: 0,
  cpuClass: 'mid',
  viableModelSizes: ['nano', 'small', 'medium'],
  capabilityHints: {
    'product-inference': 'local-OK',
    embeddings: 'local-OK',
    'auto-classify': 'primitives-only',
    'security-design': 'frontier-only',
    'multi-repo-synthesis': 'frontier-only',
    'mechanical-build': 'local-OK',
    'guardrail-verify': 'frontier-only',
    'reasoner-loop': 'primitives-only',
  },
};

/** Workstation — high-VRAM / high-RAM local inference host. */
export const WORKSTATION_PRESET: HardwareCapabilityProfile = {
  id: 'workstation',
  tier: 'workstation',
  description:
    'High-RAM / high-VRAM workstation. Medium and large local models viable; still pin security design to frontier when required.',
  ramGbMin: 32,
  ramGbTypical: 64,
  vramGbMin: 12,
  cpuClass: 'high',
  viableModelSizes: ['nano', 'small', 'medium', 'large'],
  capabilityHints: {
    'product-inference': 'local-OK',
    embeddings: 'local-OK',
    'auto-classify': 'local-OK',
    'security-design': 'frontier-only',
    'multi-repo-synthesis': 'primitives-only',
    'mechanical-build': 'local-OK',
    'guardrail-verify': 'frontier-only',
    'reasoner-loop': 'local-OK',
  },
};

const PRESETS: Record<HardwareCapabilityTier, HardwareCapabilityProfile> = {
  constrained: CONSTRAINED_PRESET,
  mainstream: MAINSTREAM_PRESET,
  workstation: WORKSTATION_PRESET,
};

export function listHardwareCapabilityPresets(): HardwareCapabilityProfile[] {
  return HARDWARE_CAPABILITY_PRESET_IDS.map((id) => structuredClone(PRESETS[id]));
}

export function getHardwareCapabilityPreset(
  tier: HardwareCapabilityTier,
): HardwareCapabilityProfile {
  return structuredClone(PRESETS[tier]);
}

export function isHardwareCapabilityTier(value: string): value is HardwareCapabilityTier {
  return value === 'constrained' || value === 'mainstream' || value === 'workstation';
}

/**
 * Deep-merge user override onto a preset. Unknown tier throws.
 * Arrays and nested objects in `override` replace (not concat) when provided.
 */
export function resolveHardwareCapabilityProfile(
  input:
    | HardwareCapabilityTier
    | (Partial<HardwareCapabilityProfile> & { tier: HardwareCapabilityTier })
    | null
    | undefined,
): HardwareCapabilityProfile | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    if (!isHardwareCapabilityTier(input)) {
      throw new Error(
        `Unknown hardware capability tier "${input}". Valid: constrained | mainstream | workstation`,
      );
    }
    return getHardwareCapabilityPreset(input);
  }
  if (!isHardwareCapabilityTier(input.tier)) {
    throw new Error(
      `Unknown hardware capability tier "${String(input.tier)}". Valid: constrained | mainstream | workstation`,
    );
  }
  const base = getHardwareCapabilityPreset(input.tier);
  const merged: HardwareCapabilityProfile = {
    ...base,
    ...input,
    tier: input.tier,
    capabilityHints: {
      ...base.capabilityHints,
      ...(input.capabilityHints ?? {}),
    },
    viableModelSizes: input.viableModelSizes ?? base.viableModelSizes,
    isOverride: true,
    extends: input.tier,
    id: input.id ?? `${input.tier}-override`,
  };
  return merged;
}

/**
 * Soft map from local-ai runtime tiers → hardware vocabulary.
 * idle/daily/snaps → constrained; heavy → mainstream (operator still chooses).
 * Does not auto-apply anything — callers opt in.
 */
export function hardwareTierForLocalAiTier(
  localAiTier: 'idle' | 'daily' | 'snaps' | 'heavy',
): HardwareCapabilityTier {
  switch (localAiTier) {
    case 'idle':
    case 'daily':
    case 'snaps':
      return 'constrained';
    case 'heavy':
      return 'mainstream';
    default: {
      const _exhaustive: never = localAiTier;
      return _exhaustive;
    }
  }
}

/**
 * Whether a model size class is listed as viable on the profile.
 * Unknown sizes are not viable (fail closed for vocabulary, not a runtime gate).
 */
export function isModelSizeViable(
  profile: HardwareCapabilityProfile,
  size: 'nano' | 'small' | 'medium' | 'large',
): boolean {
  return profile.viableModelSizes.includes(size);
}
