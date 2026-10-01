import {
  getLicensePublicKeyTrustManifest,
  getPublicKeys,
  validateLicenseKeyAgainstTrustManifest,
} from '@revealui/core/license';
import {
  canMintLicense,
  LicenseMintConfigError,
  mintLicenseKey,
} from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import { resolveSecret } from '@revealui/secrets';
import { sendCronFailureAlert } from './cron-alerts.js';
import { setLicenseCanaryDegraded } from './startup-state.js';
import { detectDeploymentMode, type EnvMap } from './validate-startup.js';

const CANARY_JOB = 'hosted-license-canary';

export type HostedLicenseCanaryOptions = {
  /** Injected by tests; production uses the normal maintained fetch path. */
  fetch?: typeof fetch;
};

/**
 * Boot-time self-test of the HOSTED deployment's license signing keypair.
 *
 * The hosted SaaS (revealui.com) signs per-subscriber license JWTs through the
 * maintained local or remote mint path and verifies them against the ordered
 * public-key set. This canary checks the signature, full matched key identity,
 * and exact JWT kid before the deployment serves traffic:
 *
 *  - `ok`        → keypair is internally consistent. Clear any prior degrade.
 *  - `mismatch`  → the signing path produced a token that no accepted key can
 *                  verify, or its kid names a different key. THROW so the boot
 *                  chain's `.catch` calls process.exit(1) — fail loud, never
 *                  serve. This is the ONLY throw path.
 *  - `degraded`  → an ambiguous / possibly-environmental fault (malformed PEM,
 *                  jose parse exception, missing verify key, signer outage).
 *                  Do NOT boot-refuse: hosted entitlement
 *                  is DB-driven, so degrade to readiness-red + alert + Sentry and
 *                  keep the process alive for diagnosis.
 *
 * No-op in Forge mode — self-hosted kits consume a studio-issued JWT and are
 * covered by `validateLicenseAtStartup` instead. Honors SKIP_ENV_VALIDATION so
 * Docker-build / build-only contexts compile without live credentials. Takes
 * `env` as an argument (defaulted to `process.env`) so tests pass fixtures.
 */
function isLocalDevEnv(env: EnvMap): boolean {
  const nodeEnv = env.NODE_ENV;
  return nodeEnv === 'development' || nodeEnv === 'test';
}

export async function runHostedLicenseCanary(
  env: EnvMap = process.env as EnvMap,
  options: HostedLicenseCanaryOptions = {},
): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  // Hosted-only: only the studio's deployment holds the signing key.
  if (detectDeploymentMode(env) !== 'hosted') {
    return;
  }

  // GAP-182: public verification keys go through @revealui/secrets so hosted
  // env injection, file mounts, and revvault share one loader. Fall back to
  // process.env so existing tests and getPublicKeys stay consistent.
  try {
    const loaded = await resolveSecret('REVEALUI_LICENSE_PUBLIC_KEY', {
      source: env as Record<string, string | undefined>,
    });
    if (loaded && !env.REVEALUI_LICENSE_PUBLIC_KEY) {
      env.REVEALUI_LICENSE_PUBLIC_KEY = loaded;
    }
  } catch {
    // EnvProvider miss is fine — getPublicKeys still reads env / _NEXT.
  }

  // Build the same normalized, ordered verification set used by requests.
  const publicKeys = getPublicKeys();

  // Local dogfood (`pnpm dogfood:api`) may set only a private key. Without
  // public keys the canary is environmentally incomplete — soft-skip in
  // development/test (no ERROR alert).
  // Production/staging still degrade+alert when keys are incomplete.
  if (publicKeys.length === 0 && isLocalDevEnv(env)) {
    logger.info(
      'Hosted license canary skipped in development/test (no REVEALUI_LICENSE_PUBLIC_KEY). ' +
        'Set public key(s) to exercise sign→verify self-check locally.',
    );
    return;
  }

  let result: import('@revealui/core/license').KeypairCanaryResult;
  if (!canMintLicense(env)) {
    result = { status: 'degraded', reason: 'hosted license signing path is not configured' };
  } else {
    try {
      // Exercise the same maintained issuance primitive used by subscribers,
      // then bind both signature and kid to the exact manifest member.
      const manifest = await getLicensePublicKeyTrustManifest();
      const token = await mintLicenseKey(
        { tier: 'pro', customerId: 'license-canary', expiresInSeconds: 60 },
        { env, fetch: options.fetch },
      );
      const verification = await validateLicenseKeyAgainstTrustManifest(
        token,
        manifest,
        'license-canary',
      );
      const matchedKey = verification
        ? manifest.keys.find((key) => key.keyId === verification.verifiedKeyId)
        : undefined;
      const { decodeProtectedHeader } = await import('jose');
      const emittedKid = decodeProtectedHeader(token).kid;
      const latestManifest = await getLicensePublicKeyTrustManifest();
      if (
        !(verification && matchedKey) ||
        emittedKid !== matchedKey.jwtKid ||
        latestManifest.digest !== manifest.digest ||
        !latestManifest.keys.some((key) => key.keyId === verification.verifiedKeyId)
      ) {
        result = { status: 'mismatch' };
      } else {
        result = {
          status: 'ok',
          kid: matchedKey.jwtKid,
          verifiedKeyId: matchedKey.keyId,
        };
      }
    } catch (error) {
      if (error instanceof LicenseMintConfigError) {
        result = { status: 'mismatch' };
      } else {
        // An authority/signer outage is ambiguous; don't leak response bodies.
        result = { status: 'degraded', reason: 'hosted signer or trust check unavailable' };
      }
    }
  }

  if (result.status === 'ok') {
    // Clear any degrade left by a prior boot (e.g. a redeploy that fixed keys).
    setLicenseCanaryDegraded(false);
    logger.info('Hosted license canary passed (sign→verify→trust-member check).');
    return;
  }

  if (result.status === 'mismatch') {
    throw new Error(
      'LICENSE CANARY FAILED: the hosted signing path produced a token that does not ' +
        'verify as the exact configured trust member named by its JWT kid. Real subscriber ' +
        'licenses would be unverifiable or ambiguously labeled. Fix signer/trust pairing ' +
        'before serving traffic.',
    );
  }

  // status === 'degraded' — alert + Sentry + readiness-red, but do not crash.
  // In development/test, log only (dogfood noise); still mark degraded for readiness.
  const error = new Error(`Hosted license canary degraded: ${result.reason}`);
  setLicenseCanaryDegraded(true, error.message);
  if (isLocalDevEnv(env)) {
    logger.warn(`${error.message} (dev soft-fail: no cron alert)`);
    return;
  }
  await sendCronFailureAlert({
    jobName: CANARY_JOB,
    error,
    severity: 'error',
    metadata: { degraded: true, readiness: 'red' },
  });
}
