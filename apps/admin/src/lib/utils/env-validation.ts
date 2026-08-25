/**
 * Environment Variable Validation for admin App
 *
 * Lightweight validation that can be imported without bundling script dependencies.
 * Validates critical environment variables at startup.
 */

import { isHostedDeployment } from '@revealui/core/deployment-mode';

/**
 * Literal hex-set check (no regex). Returns true when value is exactly 64
 * characters and every character is in [0-9a-fA-F]. Mirrors the format
 * check in `apps/server/src/lib/validate-startup.ts:240-242` but uses a
 * Set lookup instead of regex per the project no-regex rule (M2).
 */
const HEX_CHARS = new Set('0123456789abcdefABCDEF');
function isHex64(value: string): boolean {
  if (value.length !== 64) return false;
  for (const char of value) {
    if (!HEX_CHARS.has(char)) return false;
  }
  return true;
}

/**
 * Validate required environment variables
 *
 * @param options - Validation options
 * @returns Object with validation result and missing variables
 */
export function validateRequiredEnvVars(
  options: {
    /**
     * Whether to fail on missing variables (throw error) or just return result
     * @default false (returns result, doesn't throw)
     */
    failOnMissing?: boolean;

    /**
     * Environment (affects which variables are required)
     */
    environment?: string;
  } = {},
): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const { failOnMissing = false, environment } = options;

  const isFleetMode = Boolean(process.env.REVEALUI_FLEET_MODE);

  // A RevealUI Studio hosted-SaaS deployment is the ONLY posture that uses
  // self-billing (Stripe checkout), cross-subdomain session cookies, and the
  // Workspace-backed signup verification email. Every other posture — a
  // RevForge-stamped Fleet kit (isFleetMode) AND a plain OSS/unlicensed
  // self-host or marketplace-template deploy (GAP-430/GAP-440) — never uses
  // any of those, so requiring their env vars in "production" mode blocks a
  // stranger's fresh deploy for no reason. isHostedDeployment() defaults to
  // false whenever REVEALUI_LICENSE_PRIVATE_KEY is absent (the normal case
  // for a self-host template with no license key at all), so this needs no
  // new env var from the deploying operator.
  const isSaasHosted = isHostedDeployment(process.env);

  // Base required variables — apply in all environments (hosted + Fleet).
  //
  // REVEALUI_KEK encrypts API keys + MFA secrets via AES-256-GCM
  // (packages/db/src/crypto.ts). Missing KEK = silent encryption failure
  // on the first encryptApiKey/decryptApiKey call. Per revealui#836,
  // admin must validate at startup parity with apps/server's
  // validate-startup.ts:240-242.
  const baseRequired: string[] = [
    'REVEALUI_SECRET',
    'REVEALUI_PUBLIC_SERVER_URL',
    'POSTGRES_URL',
    'REVEALUI_KEK',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of baseRequired) {
    // Special handling for POSTGRES_URL - also check DATABASE_URL
    if (key === 'POSTGRES_URL') {
      if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) {
        missing.push(key);
      } else if (process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        warnings.push(
          'Using DATABASE_URL instead of POSTGRES_URL (consider standardizing to POSTGRES_URL)',
        );
      }
    } else if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Validate formats
  if (process.env.REVEALUI_SECRET && process.env.REVEALUI_SECRET.length < 32) {
    if (environment === 'production') {
      missing.push('REVEALUI_SECRET (must be at least 32 characters in production)');
    } else {
      warnings.push('REVEALUI_SECRET should be at least 32 characters');
    }
  }

  // Check URLs have protocol and no trailing whitespace
  const urlVars = ['REVEALUI_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_SERVER_URL'];
  for (const key of urlVars) {
    const url = process.env[key];
    if (url) {
      if (url !== url.trim()) {
        warnings.push(`${key} has leading/trailing whitespace (will be auto-trimmed at runtime)`);
      }
      const trimmed = url.trim();
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        warnings.push(`${key} should start with http:// or https://`);
      }
    }
  }

  // REVEALUI_KEK — 64 hex characters (32 bytes / 256 bits). Required in
  // both hosted + Fleet modes (missing-presence is caught above). When
  // set but malformed, surface as missing-equivalent (set-but-unusable).
  // Mirrors apps/server/src/lib/validate-startup.ts:240-242.
  if (process.env.REVEALUI_KEK && !isHex64(process.env.REVEALUI_KEK)) {
    missing.push('REVEALUI_KEK (must be exactly 64 hexadecimal characters)');
  }

  // REVEALUI_KEK_NEXT — optional dual-key boot for zero-downtime KEK
  // rotation. Format-when-present; empty/unset is the steady state. See
  // docs/runbooks/rotate-kek.md §Zero-downtime path.
  const kekNext = (process.env.REVEALUI_KEK_NEXT ?? '').trim();
  if (kekNext && !isHex64(kekNext)) {
    warnings.push(
      'REVEALUI_KEK_NEXT must be exactly 64 hexadecimal characters when set (transitional key during dual-key rotation).',
    );
  }

  // Production-specific validations — skipped in Fleet mode. Fleet deployments
  // run NODE_ENV=production (required by Next.js) but are not RevealUI Studio
  // SaaS: no self-billing flow, and http://localhost behind customer TLS is correct.
  if (environment === 'production' && !isFleetMode) {
    if (
      process.env.REVEALUI_PUBLIC_SERVER_URL &&
      !process.env.REVEALUI_PUBLIC_SERVER_URL.startsWith('https://')
    ) {
      const error = 'Production REVEALUI_PUBLIC_SERVER_URL must use HTTPS';
      if (failOnMissing) {
        throw new Error(error);
      }
      warnings.push(error);
    }

    // SESSION_COOKIE_DOMAIN, Stripe checkout, and Workspace signup-verification
    // email are all hosted-SaaS-only concerns (self-billing + cross-subdomain
    // cookies + Workspace-backed mail). A self-host deploy — Fleet-branded
    // (isFleetMode, checked above) or a plain OSS/unlicensed self-host or
    // marketplace-template deploy (GAP-430/GAP-440, isSaasHosted false because
    // it has no REVEALUI_LICENSE_PRIVATE_KEY) — never uses any of these, so
    // requiring them here previously blocked a stranger's fresh deploy from
    // booting without SKIP_ENV_VALIDATION.
    if (isSaasHosted) {
      // SESSION_COOKIE_DOMAIN is required in production for cross-subdomain auth.
      // Without it, sign-in throws at request time instead of at startup.
      if (!process.env.SESSION_COOKIE_DOMAIN) {
        missing.push('SESSION_COOKIE_DOMAIN');
      }

      // Hosted SaaS still seeds these client price IDs for catalog lockstep
      // (stripe-catalog / billing_catalog). Self-serve checkout posts only
      // `{ tier }` — the API resolves the Stripe price from billing_catalog.
      const stripePriceVars = [
        'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
      ];
      for (const key of stripePriceVars) {
        if (!process.env[key]) {
          missing.push(key);
        }
      }

      // Transactional email transport (Gmail API — packages/services/src/email).
      // The signup VERIFICATION email is sent from THIS admin app; without both
      // vars getEmailProvider() falls back to a no-op that drops every send, so a
      // non-first signup is created with no session and no email and (after the
      // 24h grace) is locked out with no working recovery. Required in hosted
      // production so a misconfigured deploy fails fast at boot (instrumentation.ts)
      // instead of silently locking out every new user. Fleet kits and other
      // self-host deploys are exempt (no Workspace email) via isSaasHosted above.
      const emailTransportVars = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
      for (const key of emailTransportVars) {
        if (!process.env[key]) {
          missing.push(key);
        }
      }
    }
  }

  const valid = missing.length === 0;

  if (failOnMissing && !valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    valid,
    missing,
    warnings,
  };
}
