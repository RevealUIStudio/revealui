/**
 * Deployment mode detection (GAP-260 P4-1).
 *
 * Hosted SaaS vs self-hosted Forge must not be inferred only from the presence
 * of the license signing private key. That coupling bricks admin when the key
 * is removed for signer isolation (private key leaves admin / lives only in
 * license-signer).
 *
 * Preference order:
 * 1. Explicit `REVEALUI_DEPLOYMENT_MODE=hosted|forge` (case-insensitive trim)
 * 2. Fallback (overlap window): private key present → hosted, else forge
 *
 * Sign-capable surfaces still require the private key at mint time; this module
 * only answers "which product posture is this process".
 */

export type DeploymentMode = 'forge' | 'hosted';

export type DeploymentModeEnv = Record<string, string | undefined>;

export interface DetectDeploymentModeOptions {
  /**
   * When true, empty-string env values count as "present" (Vercel Sensitive
   * pull semantics). When false (default), empty string is treated as missing.
   */
  lenient?: boolean;
}

function isPresent(env: DeploymentModeEnv, key: string, lenient: boolean): boolean {
  if (lenient) return env[key] !== undefined;
  return Boolean(env[key]);
}

/**
 * Resolve deployment mode from env.
 *
 * Explicit MODE always wins when set to `hosted` or `forge`. Any other
 * non-empty MODE value is ignored (falls through to key-presence) so a typo
 * does not hard-brick boot during the dual-run window; production boot
 * validators may still warn separately.
 */
export function detectDeploymentMode(
  env: DeploymentModeEnv,
  { lenient = false }: DetectDeploymentModeOptions = {},
): DeploymentMode {
  const raw = (env.REVEALUI_DEPLOYMENT_MODE ?? '').trim().toLowerCase();
  if (raw === 'hosted' || raw === 'forge') {
    return raw;
  }
  return isPresent(env, 'REVEALUI_LICENSE_PRIVATE_KEY', lenient) ? 'hosted' : 'forge';
}

/** Convenience: true when the process is in hosted SaaS posture. */
export function isHostedDeployment(
  env: DeploymentModeEnv = process.env as DeploymentModeEnv,
  options?: DetectDeploymentModeOptions,
): boolean {
  return detectDeploymentMode(env, options) === 'hosted';
}

/**
 * Consistency check for CI / pre-deploy: forge mode must not also carry the
 * signing private key (confused deputy). Hosted without private key is allowed
 * (signer isolation target).
 *
 * Returns an error message or null when OK.
 */
export function deploymentModeKeyConsistencyError(
  env: DeploymentModeEnv,
  { lenient = false }: DetectDeploymentModeOptions = {},
): string | null {
  const raw = (env.REVEALUI_DEPLOYMENT_MODE ?? '').trim().toLowerCase();
  if (raw !== 'hosted' && raw !== 'forge') return null;
  const hasPriv = isPresent(env, 'REVEALUI_LICENSE_PRIVATE_KEY', lenient);
  if (raw === 'forge' && hasPriv) {
    return (
      'REVEALUI_DEPLOYMENT_MODE=forge but REVEALUI_LICENSE_PRIVATE_KEY is set. ' +
      'Forge kits must not hold the studio signing key. Remove the private key ' +
      'or set MODE=hosted.'
    );
  }
  return null;
}
