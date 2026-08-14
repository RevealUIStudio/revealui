/**
 * Runtime compliance profile.
 *
 * `standard` is the default hosted/self-host posture (cookie consent +
 * optional telemetry after opt-in). `hipaa` is the fail-closed healthcare
 * configuration: no third-party browser telemetry, no optional cookies,
 * and a 15-minute idle session timeout (HIPAA 164.312(a)(2)(iii)).
 *
 * This is a technical control. It does not make a deployment "HIPAA
 * certified." A covered entity still needs a signed BAA, a risk analysis,
 * and subprocessors that will sign a BAA. See resolveComplianceProfile().
 */

export type ComplianceProfileId = 'standard' | 'hipaa';

export interface ComplianceProfile {
  id: ComplianceProfileId;
  /** Speed Insights, Plausible, Sentry Replay, and similar sinks. */
  allowThirdPartyTelemetry: boolean;
  /** Offer functional / analytics / marketing cookie categories. */
  allowOptionalCookies: boolean;
  /** Automatic logoff after this many idle seconds. 0 = disabled. */
  sessionIdleTimeoutSeconds: number;
}

export const STANDARD_COMPLIANCE_PROFILE: ComplianceProfile = {
  id: 'standard',
  allowThirdPartyTelemetry: true,
  allowOptionalCookies: true,
  sessionIdleTimeoutSeconds: 0,
};

/** 15 minutes. HIPAA automatic-logoff addressable specification. */
export const HIPAA_IDLE_TIMEOUT_SECONDS = 15 * 60;

export const HIPAA_COMPLIANCE_PROFILE: ComplianceProfile = {
  id: 'hipaa',
  allowThirdPartyTelemetry: false,
  allowOptionalCookies: false,
  sessionIdleTimeoutSeconds: HIPAA_IDLE_TIMEOUT_SECONDS,
};

const PROFILE_ENV_KEYS = [
  'REVEALUI_COMPLIANCE_PROFILE',
  'VITE_COMPLIANCE_PROFILE',
  'NEXT_PUBLIC_COMPLIANCE_PROFILE',
] as const;

export function parseComplianceProfileId(value: string | undefined | null): ComplianceProfileId {
  if (value == null) {
    return 'standard';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'hipaa') {
    return 'hipaa';
  }
  return 'standard';
}

export function resolveComplianceProfile(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): ComplianceProfile {
  let raw: string | undefined;
  for (const key of PROFILE_ENV_KEYS) {
    if (env[key]) {
      raw = env[key];
      break;
    }
  }
  return parseComplianceProfileId(raw) === 'hipaa'
    ? HIPAA_COMPLIANCE_PROFILE
    : STANDARD_COMPLIANCE_PROFILE;
}

export function isHipaaProfile(profile: ComplianceProfile): boolean {
  return profile.id === 'hipaa';
}
