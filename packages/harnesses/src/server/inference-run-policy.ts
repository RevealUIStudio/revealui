/**
 * Signed-process + host-fit policy for Inference Snaps.
 *
 * Catalog membership is the signature gate (Ubuntu store snaps on the
 * US-origin allowlist). RAM fit is the availability gate. Neither
 * `profileApply` nor boot reconcile may start a process that fails either.
 */

export type LocalAiSnapTier = 'snaps' | 'heavy';

export type SnapSizeClass = 'nano' | 'small' | 'medium' | 'large';

export interface SnapRunPolicy {
  snapName: string;
  minMemAvailableGiB: number;
  sizeClass: SnapSizeClass;
}

export interface SnapTierChoice {
  snapName: string;
  demoted: boolean;
  reason: string;
}

/** Lockstep PRODUCT_INFERENCE_SNAPS ids in inference-service.ts. */
export const SIGNED_PRODUCT_SNAP_IDS = [
  'gemma3',
  'gemma4',
  'nemotron-3-nano',
  'nemotron-3-nano-omni',
] as const;

export type SignedProductSnapId = (typeof SIGNED_PRODUCT_SNAP_IDS)[number];

export const DEFAULT_SNAPS_SNAP: SignedProductSnapId = 'gemma3';
export const DEFAULT_HEAVY_SNAP: SignedProductSnapId = 'nemotron-3-nano';

/**
 * Boot persist (snap start --enable) only when the host has workstation-class
 * available RAM. Constrained WSL (~4Gi total) must demand-start.
 */
export const BOOT_PERSIST_MIN_MEM_GIB = 8;

export const PRODUCT_SNAP_RUN_POLICY: Record<SignedProductSnapId, SnapRunPolicy> = {
  gemma3: {
    snapName: 'gemma3',
    minMemAvailableGiB: 1.5,
    sizeClass: 'nano',
  },
  gemma4: {
    snapName: 'gemma4',
    minMemAvailableGiB: 3.5,
    sizeClass: 'small',
  },
  'nemotron-3-nano': {
    snapName: 'nemotron-3-nano',
    minMemAvailableGiB: 8,
    sizeClass: 'large',
  },
  'nemotron-3-nano-omni': {
    snapName: 'nemotron-3-nano-omni',
    minMemAvailableGiB: 8,
    sizeClass: 'large',
  },
};

export function isSignedProductSnap(name: string): name is SignedProductSnapId {
  return (SIGNED_PRODUCT_SNAP_IDS as readonly string[]).includes(name);
}

export function snapFitsHost(name: string, memAvailableGiB: number | null): boolean {
  if (!isSignedProductSnap(name)) return false;
  const policy = PRODUCT_SNAP_RUN_POLICY[name];
  if (memAvailableGiB == null) return policy.sizeClass === 'nano';
  return memAvailableGiB >= policy.minMemAvailableGiB;
}

export function persistSnapAtBoot(name: string, memAvailableGiB: number | null): boolean {
  return snapFitsHost(name, memAvailableGiB) && (memAvailableGiB ?? 0) >= BOOT_PERSIST_MIN_MEM_GIB;
}

export function chooseSnapForTier(
  tier: LocalAiSnapTier,
  memAvailableGiB: number | null,
): SnapTierChoice {
  const wanted: SignedProductSnapId = tier === 'heavy' ? DEFAULT_HEAVY_SNAP : DEFAULT_SNAPS_SNAP;
  if (snapFitsHost(wanted, memAvailableGiB)) {
    return { snapName: wanted, demoted: false, reason: '' };
  }
  if (tier === 'heavy' && snapFitsHost(DEFAULT_SNAPS_SNAP, memAvailableGiB)) {
    const memLabel = memAvailableGiB == null ? 'unknown' : `${memAvailableGiB}`;
    return {
      snapName: DEFAULT_SNAPS_SNAP,
      demoted: true,
      reason: `heavy ${wanted} does not fit ~${memLabel}Gi available RAM; using ${DEFAULT_SNAPS_SNAP}`,
    };
  }
  const memLabel = memAvailableGiB == null ? 'unknown' : `${memAvailableGiB}`;
  throw new Error(
    `No signed inference snap fits this host (~${memLabel}Gi available). Apply idle instead.`,
  );
}
