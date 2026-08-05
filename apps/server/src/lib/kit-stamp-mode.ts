/**
 * GAP-448 Phase 2-B: kit stamp delivery mode.
 *
 * - thin (default): jsonb package only (P2-A)
 * - full: tar.gz package uploaded to object storage (artifact_uri); optional
 *   local RevForge stamp.sh when REVEALUI_REVFORGE_ROOT is set (long worker)
 */

export type KitStampMode = 'thin' | 'full';

/**
 * Resolve stamp mode from env. Unknown values fall back to thin (safe default).
 */
export function resolveKitStampMode(env: NodeJS.ProcessEnv = process.env): KitStampMode {
  const raw = env.REVEALUI_KIT_STAMP_MODE?.trim().toLowerCase();
  if (raw === 'full') {
    return 'full';
  }
  return 'thin';
}
