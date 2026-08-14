import { resolveComplianceProfile } from '@revealui/security';

/** Client Sentry: pass the inlined NEXT_PUBLIC_COMPLIANCE_PROFILE string only. */
export function shouldInitClientSentry(publicProfile: string | undefined): boolean {
  return publicProfile?.trim().toLowerCase() !== 'hipaa';
}

export function shouldInitSentry(allowThirdPartyTelemetry: boolean): boolean {
  return allowThirdPartyTelemetry;
}

/** Server and edge Sentry can read the full env, including REVEALUI_COMPLIANCE_PROFILE. */
export function shouldInitSentryFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return shouldInitSentry(resolveComplianceProfile(env).allowThirdPartyTelemetry);
}
