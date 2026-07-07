/**
 * Startup state flags  -  shared between index.ts and health routes.
 * Extracted to avoid circular imports (health.ts ↔ index.ts).
 */

/** Set to true when CORS_ORIGIN is missing in production */
export let corsConfigMissing = false;

export function setCorsConfigMissing(value: boolean): void {
  corsConfigMissing = value;
}

/**
 * Set when the hosted license-keypair canary DEGRADES at boot — a jose/parse
 * exception, a missing verify key, or a kid outside the configured allowlist.
 * Distinct from a definitive keypair mismatch, which THROWS at boot (index /
 * worker `.catch` → process.exit). Degrade keeps the process alive (hosted
 * entitlement is DB-driven) but flips `/health/ready` red so ops notices
 * instead of the deployment silently signing licenses it cannot verify.
 */
export let licenseCanaryDegraded = false;
/** Human-readable reason for the current degrade, surfaced on the readiness probe. */
export let licenseCanaryDegradedReason: string | undefined;

export function setLicenseCanaryDegraded(value: boolean, reason?: string): void {
  licenseCanaryDegraded = value;
  licenseCanaryDegradedReason = value ? reason : undefined;
}
