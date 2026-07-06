import { getPublicKeys, normalizePem, selfVerifyLicenseKeypair } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { sendCronFailureAlert } from './cron-alerts.js';
import { setLicenseCanaryDegraded } from './startup-state.js';
import { type EnvMap, detectDeploymentMode } from './validate-startup.js';

const CANARY_JOB = 'hosted-license-canary';

/**
 * Boot-time self-test of the HOSTED deployment's license signing keypair.
 *
 * The hosted SaaS (revealui.com) signs per-subscriber license JWTs with
 * REVEALUI_LICENSE_PRIVATE_KEY and verifies them against the ordered public-key
 * list (REVEALUI_LICENSE_PUBLIC_KEY[_NEXT]). If those keys don't actually pair,
 * every subscriber token the deployment mints is unverifiable — but nothing
 * catches that until a real customer request fails. This canary signs a
 * throwaway token with the deployment's own private key and verifies it against
 * its own public keys BEFORE the deployment serves traffic:
 *
 *  - `ok`        → keypair is internally consistent. Clear any prior degrade.
 *  - `mismatch`  → the deployment signed a token NONE of its public keys can
 *                  verify (definitive keypair mismatch). THROW so the boot
 *                  chain's `.catch` calls process.exit(1) — fail loud, never
 *                  serve. This is the ONLY throw path.
 *  - `degraded`  → an ambiguous / possibly-environmental fault (malformed PEM,
 *                  jose parse exception, missing verify key, kid outside the
 *                  configured allowlist). Do NOT boot-refuse: hosted entitlement
 *                  is DB-driven, so degrade to readiness-red + alert + Sentry and
 *                  keep the process alive for diagnosis.
 *
 * No-op in Forge mode — self-hosted kits consume a studio-issued JWT and are
 * covered by `validateLicenseAtStartup` instead. Honors SKIP_ENV_VALIDATION so
 * Docker-build / build-only contexts compile without live credentials. Takes
 * `env` as an argument (defaulted to `process.env`) so tests pass fixtures.
 */
export async function runHostedLicenseCanary(env: EnvMap = process.env as EnvMap): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  // Hosted-only: only the studio's deployment holds the signing key.
  if (detectDeploymentMode(env) !== 'hosted') {
    return;
  }

  const rawPrivate = env.REVEALUI_LICENSE_PRIVATE_KEY;
  if (!rawPrivate) {
    // detectDeploymentMode === 'hosted' already implies presence; defensive.
    return;
  }

  // Build the SAME newline-normalized private key + ordered public-key list the
  // request path uses, so the canary can't pass while real verification fails.
  const privateKey = normalizePem(rawPrivate);
  const publicKeys = getPublicKeys();

  const result = await selfVerifyLicenseKeypair(privateKey, publicKeys);

  if (result.status === 'ok') {
    // Clear any degrade left by a prior boot (e.g. a redeploy that fixed keys).
    setLicenseCanaryDegraded(false);
    logger.info('Hosted license canary passed (sign→verify→kid self-check).');
    return;
  }

  if (result.status === 'mismatch') {
    throw new Error(
      'LICENSE CANARY FAILED: the hosted deployment signed a token with ' +
        'REVEALUI_LICENSE_PRIVATE_KEY that NONE of its configured public keys ' +
        '(REVEALUI_LICENSE_PUBLIC_KEY / REVEALUI_LICENSE_PUBLIC_KEY_NEXT) can verify. ' +
        'The signing key does not pair with any verification key — real subscriber ' +
        'licenses would be unverifiable. Fix the keypair before serving traffic.',
    );
  }

  // status === 'degraded' — alert + Sentry + readiness-red, but do not crash.
  const error = new Error(`Hosted license canary degraded: ${result.reason}`);
  setLicenseCanaryDegraded(true, error.message);
  await sendCronFailureAlert({
    jobName: CANARY_JOB,
    error,
    severity: 'error',
    metadata: { degraded: true, readiness: 'red' },
  });
}
