/**
 * RevForge per-customer license issuance.
 *
 * The Stripe webhook handler (apps/server/src/routes/webhooks.ts) issues licenses
 * for SaaS subscribers. This module is the analogous issuer for self-hosted
 * RevForge customers — paid direct (source-license / sales) and stamped via
 * forge/stamp.sh.
 *
 * Pure function: takes options + Ed25519 keys, returns a signed JWT plus
 * descriptive metadata. The CLI wrapper (scripts/setup/issue-revforge-license.ts)
 * handles argv parsing and reading keys from the environment.
 */

import { generateLicenseKey, type LicensePayload, validateLicenseKey } from './license.js';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const VALID_REVFORGE_TIERS = ['pro', 'max', 'enterprise'] as const;
export type RevForgeTier = (typeof VALID_REVFORGE_TIERS)[number];

export interface IssueRevForgeLicenseOptions {
  /** Customer slug; becomes the JWT customerId. Must match SLUG_PATTERN. */
  slug: string;
  /** Paid tier the license unlocks. */
  tier: RevForgeTier;
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

export interface IssueRevForgeLicenseResult {
  /** Signed EdDSA JWT — the license key the customer installs. */
  licenseKey: string;
  /** Customer identifier embedded in the JWT (the slug). */
  customerId: string;
  /** Tier embedded in the JWT. */
  tier: RevForgeTier;
  /** Whether this is a perpetual license (no exp claim). */
  perpetual: boolean;
  /** ISO-8601 timestamp of issuance. */
  issuedAt: string;
  /** ISO-8601 expiry, or null for perpetual licenses. */
  expiresAt: string | null;
  /** The payload that was signed (without iat/exp/jti; those live inside the JWT). */
  payload: Omit<LicensePayload, 'iat' | 'exp' | 'jti'>;
}

/**
 * Issue a signed RevForge license JWT for a paying customer.
 *
 * @throws Error on invalid slug, invalid tier, mutually-exclusive flag combos,
 * non-positive numeric overrides, or a private/public pair that is not a
 * matching Ed25519 keypair. The error message names the offending field (or, for
 * the keypair case, carries the `REVFORGE_LICENSE_KEYPAIR_MISMATCH` prefix) so
 * callers can surface it directly to the operator.
 */
export async function issueRevForgeLicense(
  opts: IssueRevForgeLicenseOptions,
  keys: { privateKey: string; publicKey: string },
): Promise<IssueRevForgeLicenseResult> {
  if (!SLUG_PATTERN.test(opts.slug)) {
    throw new Error(
      `Invalid --slug "${opts.slug}": must match ^[a-z0-9][a-z0-9-]*$ (kebab-case, start with letter or digit).`,
    );
  }
  if (!VALID_REVFORGE_TIERS.includes(opts.tier)) {
    throw new Error(
      `Invalid --tier "${opts.tier}": must be one of ${VALID_REVFORGE_TIERS.join(', ')}.`,
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

  // jti is auto-generated inside generateLicenseKey when not supplied (per
  // Phase 1 audit B-2 — every issued token carries a unique JWT ID for
  // forward-compatible per-token revocation).
  const payload: Omit<LicensePayload, 'iat' | 'exp' | 'jti'> = {
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

  // Pair-match guard: prove the supplied public key can verify the JWT we just
  // signed with the supplied private key. If it cannot, the two are not a
  // matching Ed25519 keypair, and issuing anyway would hand back a license whose
  // baked REVEALUI_LICENSE_PUBLIC_KEY crash-loops the kit at boot with
  // "LICENSE VALIDATION FAILED" (apps/server validateLicenseAtStartup). Reusing
  // the runtime verifier (validateLicenseKey) guarantees this check agrees
  // exactly with the deployment-time check, so a mismatched pair can never reach
  // a stamped customer kit.
  const keypairSelfCheck = await validateLicenseKey(licenseKey, keys.publicKey);
  if (keypairSelfCheck === null) {
    throw new Error(
      'REVFORGE_LICENSE_KEYPAIR_MISMATCH: the supplied public key cannot verify a ' +
        'license JWT signed by the supplied private key, so they are not a matching ' +
        'Ed25519 keypair. A kit issued with this pair would crash at boot with ' +
        'LICENSE VALIDATION FAILED. Source REVEALUI_LICENSE_PRIVATE_KEY and ' +
        'REVEALUI_LICENSE_PUBLIC_KEY from the same keypair in revvault and retry.',
    );
  }

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
