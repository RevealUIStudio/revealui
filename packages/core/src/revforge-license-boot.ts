/**
 * Shared Forge / self-host license boot gate for apps/admin + apps/server.
 *
 * Extracted from the intentional admin/server dual after the 2026-08-02 fleet
 * redundancy audit. Server previously owned the full check (customer id, kid
 * mismatch, domain binding); admin had a shortened copy. One implementation
 * so the two cannot drift (instrumentation.ts TODO resolved).
 *
 * Throws on failure. Callers that must not throw (Next.js instrumentation)
 * catch and `process.exit(1)`.
 */

import {
  type DeploymentMode,
  detectDeploymentMode as detectDeploymentModeCore,
} from './deployment-mode.js';
import { computeKeyId, hostMatchesLicensedDomains, validateLicenseKey } from './license.js';
import { logger } from './observability/logger.js';

export type EnvMap = Record<string, string | undefined>;

/**
 * GAP-436 (owner-ruled 2026-07-26): plain OSS/self-host opt-in when no key is
 * present. Stamped RevForge kits always bake a key, so they never hit this.
 */
export const ALLOW_UNLICENSED_SELF_HOST_ENV = 'REVEALUI_ALLOW_UNLICENSED_SELF_HOST';

/**
 * Extracts the `kid` (key id) from a JWT protected header WITHOUT verifying
 * the signature. Used only to sharpen error messages after cryptographic
 * verification has already failed.
 */
export function decodeJwtKid(jwt: string): string | undefined {
  const headerSegment = jwt.split('.')[0];
  if (!headerSegment) return undefined;
  try {
    const header: unknown = JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8'));
    if (header && typeof header === 'object' && 'kid' in header) {
      const { kid } = header as { kid?: unknown };
      return typeof kid === 'string' ? kid : undefined;
    }
  } catch {
    // Malformed header — caller surfaces generic invalid-license error.
  }
  return undefined;
}

/**
 * Forge-mode license enforcement at process boot.
 *
 * - Hosted mode: no-op.
 * - Forge mode + no key + ALLOW_UNLICENSED_SELF_HOST: Free (OSS) tier log, return.
 * - Forge mode otherwise: require key + public key, verify JWT, customerId
 *   (when configured) + domain binding. Empty domains or empty public URL
 *   fail closed unless ALLOW_UNLICENSED_SELF_HOST.
 *
 * `SKIP_ENV_VALIDATION=true` is honored only in a documented build/test/dev
 * context (`NODE_ENV=test|development` or Next `NEXT_PHASE` build). That
 * covers Vitest, `pnpm dev:api`, and the CI tsx boot smoke. Forge/production
 * runtime ignores the flag and still requires a key.
 */
function isDocumentedLicenseSkipContext(env: EnvMap): boolean {
  if (env.NODE_ENV === 'test' || env.NODE_ENV === 'development') return true;
  const phase = env.NEXT_PHASE;
  return phase === 'phase-production-build' || phase === 'phase-development-build';
}

export async function validateForgeLicenseAtStartup(
  env: EnvMap = process.env as EnvMap,
): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true' && isDocumentedLicenseSkipContext(env)) {
    return;
  }

  const mode: DeploymentMode = detectDeploymentModeCore(env);
  if (mode !== 'forge') {
    return;
  }

  if (!env.REVEALUI_LICENSE_KEY) {
    if (env[ALLOW_UNLICENSED_SELF_HOST_ENV] === 'true') {
      logger.info('no license key — running Free (OSS) tier');
      return;
    }
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is required for RevForge deployments. ' +
        'Run bin/revvault-bootstrap.sh to materialize docker/.env from revvault, ' +
        'or contact the operator who stamped this kit. A plain self-host deployment that ' +
        `intends to run without a license should set ${ALLOW_UNLICENSED_SELF_HOST_ENV}=true to ` +
        'boot at Free (OSS) tier instead.',
    );
  }
  if (!env.REVEALUI_LICENSE_PUBLIC_KEY) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_PUBLIC_KEY is required for RevForge deployments. ' +
        'Stamped kits embed this value in docker/.env.example; check that it survived the bootstrap step.',
    );
  }

  // Restore real newlines if the public key landed as a single-line PEM
  // (stamp.sh .env encoding). Split/join, no authored regex — mirrors
  // @revealui/core/license normalizePem. GAP-259 P0-4.
  const publicKey = env.REVEALUI_LICENSE_PUBLIC_KEY.split('\\n').join('\n');
  const expectedCustomerId = env.REVEALUI_LICENSED_CUSTOMER_ID || undefined;
  const payload = await validateLicenseKey(env.REVEALUI_LICENSE_KEY, publicKey, expectedCustomerId);
  if (!payload) {
    const tokenKid = decodeJwtKid(env.REVEALUI_LICENSE_KEY);
    if (tokenKid !== undefined) {
      const expectedKid = await computeKeyId(publicKey);
      if (tokenKid !== expectedKid) {
        throw new Error(
          'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_PUBLIC_KEY does not match the key that ' +
            `signed REVEALUI_LICENSE_KEY (license key id "${tokenKid}", configured public key id ` +
            `"${expectedKid}"). The stamped kit baked the wrong public key. Re-issue the license ` +
            'with the matching keypair, or bake the public key that pairs with the signing key, ' +
            'then re-run bin/revvault-bootstrap.sh. Contact the operator who stamped this kit.',
        );
      }
    }
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is invalid, expired beyond grace, ' +
        'signed with a key that does not match REVEALUI_LICENSE_PUBLIC_KEY, or its ' +
        'customerId does not match REVEALUI_LICENSED_CUSTOMER_ID (if set). ' +
        'Contact the operator who stamped this kit to re-issue the license.',
    );
  }

  const domains = payload.domains ?? [];
  const allowUnlicensed = env[ALLOW_UNLICENSED_SELF_HOST_ENV] === 'true';
  if (domains.length === 0) {
    if (allowUnlicensed) {
      return;
    }
    throw new Error(
      'LICENSE VALIDATION FAILED: this RevForge license has no domains claim. ' +
        'A published kit must bind to licensed hosts. Re-issue the license with ' +
        `domains, or set ${ALLOW_UNLICENSED_SELF_HOST_ENV}=true for an explicit Free (OSS) opt-out.`,
    );
  }

  const publicUrl = (env.REVEALUI_PUBLIC_SERVER_URL ?? env.NEXT_PUBLIC_SERVER_URL ?? '').trim();
  if (!publicUrl) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_PUBLIC_SERVER_URL (or NEXT_PUBLIC_SERVER_URL) ' +
        'is required when the license carries a domains claim. An empty public URL skips ' +
        'domain lock and is not permitted on Forge.',
    );
  }
  let host = '';
  try {
    host = new URL(publicUrl).hostname;
  } catch {
    host = '';
  }
  if (!hostMatchesLicensedDomains(host, domains)) {
    throw new Error(
      'LICENSE VALIDATION FAILED: this license is restricted to ' +
        `[${domains.join(', ')}], but REVEALUI_PUBLIC_SERVER_URL host ` +
        `"${host || '(unparseable)'}" is not among them. Set REVEALUI_PUBLIC_SERVER_URL ` +
        'to a licensed domain, or contact the operator who stamped this kit.',
    );
  }
}
