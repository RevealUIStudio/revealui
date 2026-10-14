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

/** Explicit posture for authorization. Unknown configuration grants no Forge authority. */
export function getExplicitDeploymentMode(
  env: DeploymentModeEnv = process.env as DeploymentModeEnv,
): DeploymentMode | null {
  const raw = (env.REVEALUI_DEPLOYMENT_MODE ?? '').trim().toLowerCase();
  return raw === 'hosted' || raw === 'forge' ? raw : null;
}

/** Production startup requires explicit posture before accepting requests. */
export function requireExplicitDeploymentMode(
  env: DeploymentModeEnv = process.env as DeploymentModeEnv,
): DeploymentMode {
  const mode = getExplicitDeploymentMode(env);
  if (!mode) throw new Error('REVEALUI_DEPLOYMENT_MODE must be explicitly set to hosted or forge');
  return mode;
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
  const explicit = getExplicitDeploymentMode(env);
  if (explicit) return explicit;
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

/**
 * Env names that must not be set on a hosted deploy. A set value lets the
 * platform pay for model inference, point every account at a shared local
 * model, or re-enable a shared env key.
 *
 * Local-model URLs: OLLAMA_BASE_URL, INFERENCE_SNAPS_BASE_URL.
 * HOSTED_BYOK_DISPATCH is banned at any value. Forge ignores this list.
 */
export const HOSTED_BANNED_INFERENCE_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'HF_TOKEN',
  'OPENROUTER_API_KEY',
  'LLM_PROVIDER',
  'OLLAMA_BASE_URL',
  'INFERENCE_SNAPS_BASE_URL',
  'HOSTED_BYOK_DISPATCH',
] as const;

export type HostedBannedInferenceEnvKey = (typeof HOSTED_BANNED_INFERENCE_ENV_KEYS)[number];

function bannedInferenceEnvIsSet(env: DeploymentModeEnv, key: string, lenient: boolean): boolean {
  const value = env[key];
  if (value === undefined) return false;
  if (lenient) return true;
  return value.trim() !== '';
}

/**
 * Banned inference env names that are set while this process is hosted.
 * Empty when the process is forge, or when hosted and none of the names are set.
 * `lenient` counts an empty string as set (pre-deploy sensitive pulls).
 * Mode detection itself stays strict: an empty private key does not flip forge to hosted.
 */
export function hostedPlatformInferenceViolations(
  env: DeploymentModeEnv,
  { lenient = false }: DetectDeploymentModeOptions = {},
): HostedBannedInferenceEnvKey[] {
  if (detectDeploymentMode(env) !== 'hosted') return [];
  const found: HostedBannedInferenceEnvKey[] = [];
  for (const key of HOSTED_BANNED_INFERENCE_ENV_KEYS) {
    if (bannedInferenceEnvIsSet(env, key, lenient)) found.push(key);
  }
  return found;
}

/** Boot error when a hosted process carries a platform model key or local-model URL. */
export function hostedPlatformInferenceError(
  env: DeploymentModeEnv,
  options?: DetectDeploymentModeOptions,
): string | null {
  const found = hostedPlatformInferenceViolations(env, options);
  if (found.length === 0) return null;
  return (
    'Hosted deployments must not set platform model keys, local-model URLs, or HOSTED_BYOK_DISPATCH. ' +
    `Remove: ${found.join(', ')}. Customers bring their own provider key.`
  );
}
