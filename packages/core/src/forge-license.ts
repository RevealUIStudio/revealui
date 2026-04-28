/**
 * Forge per-customer license issuance.
 *
 * The Stripe webhook handler (apps/server/src/routes/webhooks.ts) issues licenses
 * for SaaS subscribers. This module is the analogous issuer for self-hosted
 * Forge customers — paid direct (source-license / sales) and stamped via
 * forge/stamp.sh.
 *
 * Pure function: takes options + RSA keys, returns a signed JWT plus
 * descriptive metadata. The CLI wrapper (scripts/setup/issue-forge-license.ts)
 * handles argv parsing and reading keys from the environment.
 */

import { generateLicenseKey, type LicensePayload } from './license.js';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const VALID_FORGE_TIERS = ['pro', 'max', 'enterprise'] as const;
export type ForgeTier = (typeof VALID_FORGE_TIERS)[number];

export interface IssueForgeLicenseOptions {
  /** Customer slug; becomes the JWT customerId. Must match SLUG_PATTERN. */
  slug: string;
  /** Paid tier the license unlocks. */
  tier: ForgeTier;
  /** JWT expiry in days. Omit for the 365-day default. Mutually exclusive with `perpetual`. */
  expiresInDays?: number;
  /** One-time purchase: omit `exp` claim entirely. Mutually exclusive with `expiresInDays`. */
  perpetual?: boolean;
  /** Override per-tier site cap. */
  maxSites?: number;
  /** Override per-tier user cap. */
  maxUsers?: number;
  /** Allowed deployment hostnames. */
  domains?: string[];
}

export interface IssueForgeLicenseResult {
  /** Signed RS256 JWT — the license key the customer installs. */
  licenseKey: string;
  /** Customer identifier embedded in the JWT (the slug). */
  customerId: string;
  /** Tier embedded in the JWT. */
  tier: ForgeTier;
  /** Whether this is a perpetual license (no exp claim). */
  perpetual: boolean;
  /** ISO-8601 timestamp of issuance. */
  issuedAt: string;
  /** ISO-8601 expiry, or null for perpetual licenses. */
  expiresAt: string | null;
  /** The payload that was signed (without iat/exp; those live inside the JWT). */
  payload: Omit<LicensePayload, 'iat' | 'exp'>;
}

/**
 * Issue a signed Forge license JWT for a paying customer.
 *
 * @throws Error on invalid slug, invalid tier, mutually-exclusive flag combos,
 * or non-positive numeric overrides. The error message names the offending
 * field so callers can surface it directly to the operator.
 */
export async function issueForgeLicense(
  opts: IssueForgeLicenseOptions,
  keys: { privateKey: string; publicKey: string },
): Promise<IssueForgeLicenseResult> {
  if (!SLUG_PATTERN.test(opts.slug)) {
    throw new Error(
      `Invalid --slug "${opts.slug}": must match ^[a-z0-9][a-z0-9-]*$ (kebab-case, start with letter or digit).`,
    );
  }
  if (!VALID_FORGE_TIERS.includes(opts.tier)) {
    throw new Error(
      `Invalid --tier "${opts.tier}": must be one of ${VALID_FORGE_TIERS.join(', ')}.`,
    );
  }
  if (opts.perpetual && opts.expiresInDays !== undefined) {
    throw new Error('--perpetual and --expires-in-days are mutually exclusive.');
  }
  if (opts.expiresInDays !== undefined) {
    if (!Number.isInteger(opts.expiresInDays) || opts.expiresInDays <= 0) {
      throw new Error(
        `Invalid --expires-in-days "${opts.expiresInDays}": must be a positive integer.`,
      );
    }
  }
  if (opts.maxSites !== undefined && (!Number.isInteger(opts.maxSites) || opts.maxSites <= 0)) {
    throw new Error(`Invalid --max-sites "${opts.maxSites}": must be a positive integer.`);
  }
  if (opts.maxUsers !== undefined && (!Number.isInteger(opts.maxUsers) || opts.maxUsers <= 0)) {
    throw new Error(`Invalid --max-users "${opts.maxUsers}": must be a positive integer.`);
  }

  const payload: Omit<LicensePayload, 'iat' | 'exp'> = {
    tier: opts.tier,
    customerId: opts.slug,
    ...(opts.perpetual ? { perpetual: true } : {}),
    ...(opts.maxSites !== undefined ? { maxSites: opts.maxSites } : {}),
    ...(opts.maxUsers !== undefined ? { maxUsers: opts.maxUsers } : {}),
    ...(opts.domains && opts.domains.length > 0 ? { domains: opts.domains } : {}),
  };

  // Perpetual: pass null to omit exp claim. Otherwise translate days → seconds.
  // Default (neither flag): 365-day subscription, matching generateLicenseKey's default.
  const expiresInSeconds = opts.perpetual
    ? null
    : opts.expiresInDays !== undefined
      ? opts.expiresInDays * 24 * 60 * 60
      : 365 * 24 * 60 * 60;

  const issuedAtMs = Date.now();
  const licenseKey = await generateLicenseKey(
    payload,
    keys.privateKey,
    expiresInSeconds,
    keys.publicKey,
  );

  const expiresAt =
    expiresInSeconds === null ? null : new Date(issuedAtMs + expiresInSeconds * 1000).toISOString();

  return {
    licenseKey,
    customerId: opts.slug,
    tier: opts.tier,
    perpetual: opts.perpetual === true,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt,
    payload,
  };
}
