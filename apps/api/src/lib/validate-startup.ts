import { validateLicenseKey } from '@revealui/core/license';

export type EnvMap = Record<string, string | undefined>;

/**
 * Where this RevealUI deployment runs.
 *
 * - `hosted`: revealui.com SaaS. We sign per-subscriber license JWTs, so
 *   `REVEALUI_LICENSE_PRIVATE_KEY` is set; entitlement is DB-driven via
 *   `account_entitlements` rows. Strict Stripe + HTTPS posture.
 * - `forge`: self-hosted Forge customer kit (Docker stack from
 *   `forge/stamp.sh`). Customer consumes a studio-issued JWT in
 *   `REVEALUI_LICENSE_KEY` against the master public key in
 *   `REVEALUI_LICENSE_PUBLIC_KEY`. No Stripe, no signing key, can run on
 *   `http://localhost`.
 *
 * Detection is by presence of the signing key: only the studio's hosted
 * deployment has it.
 */
export type DeploymentMode = 'forge' | 'hosted';

export function detectDeploymentMode(env: EnvMap): DeploymentMode {
  return env.REVEALUI_LICENSE_PRIVATE_KEY ? 'hosted' : 'forge';
}

const REQUIRED_ALWAYS = ['POSTGRES_URL', 'NODE_ENV'] as const;

const REQUIRED_IN_PRODUCTION_HOSTED = [
  'REVEALUI_SECRET',
  'REVEALUI_KEK',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'REVEALUI_LICENSE_PRIVATE_KEY',
  'REVEALUI_CRON_SECRET',
  'CORS_ORIGIN',
  // Alert destination for unreconciled Stripe webhooks and other ops-critical
  // signals. Without it, ops email falls back to a hard-coded default; making
  // this required forces an explicit decision per environment.
  'REVEALUI_ALERT_EMAIL',
] as const;

const REQUIRED_IN_PRODUCTION_FORGE = [
  'REVEALUI_SECRET',
  'REVEALUI_KEK',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  // The studio-issued JWT and matching public key. validateLicenseAtStartup
  // verifies the JWT itself; this list just ensures both vars are present so
  // the boot fails with a useful name rather than a generic JWT error.
  'REVEALUI_LICENSE_KEY',
  'REVEALUI_LICENSE_PUBLIC_KEY',
  'CORS_ORIGIN',
] as const;

/**
 * Validate required environment variables at startup so any missing or
 * misformatted config causes a loud failure at boot rather than silently
 * failing on the first real request.
 *
 * Mode dispatch (see DeploymentMode):
 *  - Hosted (revealui.com SaaS) — strict Stripe + HTTPS posture, full
 *    REQUIRED_IN_PRODUCTION_HOSTED list.
 *  - Forge (self-hosted customer kit) — license JWT + public key required;
 *    Stripe / CRON / ALERT_EMAIL / HTTPS-CORS not enforced (customer may run
 *    on `http://localhost` and has no Stripe webhooks back to revealui.com).
 *
 * Layers (in order):
 *  1. Always-required presence — POSTGRES_URL, NODE_ENV
 *  2. Production-required presence — mode-specific list
 *  3. Production format — KEK / SECRET / URL parity shared across modes;
 *     Stripe / HTTPS-only URLs / CORS-HTTPS / cron-secret length / alert-
 *     email format are hosted-only.
 *
 * `STRIPE_LIVE_MODE` toggle (hosted mode only):
 *   - When `STRIPE_LIVE_MODE=true`: enforces `sk_live_` / `pk_live_` prefixes
 *     (real customer money flows).
 *   - When `STRIPE_LIVE_MODE` is unset or any other value: enforces `sk_test_`
 *     / `pk_test_` prefixes and emits a loud boot-time warning that the API
 *     is running with TEST Stripe keys in production. This is the
 *     pre-launch / pre-LLC / pre-billing-audit posture (gated on GAP-124
 *     in revealui-jv).
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build and other build-only
 * contexts can compile without live credentials present. Forge customer
 * RUNTIME containers must NOT set this — boot-time license enforcement
 * (validateLicenseAtStartup) honors the same flag.
 *
 * Takes `env` as an argument (defaulted to `process.env`) so tests can pass
 * explicit fixtures without touching real process state.
 */
export function validateStartup(env: EnvMap = process.env as EnvMap): void {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  const missing = REQUIRED_ALWAYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED: Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env file or deployment configuration.',
    );
  }

  if (env.NODE_ENV !== 'production') {
    return;
  }

  const mode = detectDeploymentMode(env);
  const required = mode === 'forge' ? REQUIRED_IN_PRODUCTION_FORGE : REQUIRED_IN_PRODUCTION_HOSTED;
  const missingProd = required.filter((key) => !env[key]);
  if (missingProd.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED (${mode} mode): Missing production-required env vars: ${missingProd.join(', ')}.`,
    );
  }

  const errors: string[] = [];

  // ── Format checks that apply in BOTH modes ────────────────────────

  // KEK — exactly 64 hex characters (32 bytes / 256 bits)
  const kek = env.REVEALUI_KEK ?? '';
  if (!/^[0-9a-f]{64}$/i.test(kek)) {
    errors.push('REVEALUI_KEK must be exactly 64 hexadecimal characters (256 bits).');
  }

  // Secret minimum length
  const secret = env.REVEALUI_SECRET ?? '';
  if (secret.length < 32) {
    errors.push('REVEALUI_SECRET must be at least 32 characters.');
  }

  // URL parity — if both are set, they must match. Applies in both modes.
  const publicUrl = env.REVEALUI_PUBLIC_SERVER_URL ?? '';
  const nextPublicUrl = env.NEXT_PUBLIC_SERVER_URL ?? '';
  if (publicUrl && nextPublicUrl && publicUrl !== nextPublicUrl) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL must match.');
  }

  // ── Hosted-mode-specific checks ───────────────────────────────────
  if (mode === 'hosted') {
    const stripeLiveMode = env.STRIPE_LIVE_MODE === 'true';
    if (!stripeLiveMode) {
      emitStripeTestModeWarning();
    }

    // Stripe secret key — prefix depends on STRIPE_LIVE_MODE.
    const stripeSecretKey = env.STRIPE_SECRET_KEY ?? '';
    if (stripeLiveMode) {
      if (!stripeSecretKey.startsWith('sk_live_')) {
        errors.push(
          'STRIPE_SECRET_KEY must be a live key (sk_live_...) when STRIPE_LIVE_MODE=true.',
        );
      }
    } else {
      if (!stripeSecretKey.startsWith('sk_test_')) {
        errors.push(
          'STRIPE_SECRET_KEY must be a test key (sk_test_...) when STRIPE_LIVE_MODE is unset/false. ' +
            'Set STRIPE_LIVE_MODE=true to use live keys (gated on the billing-readiness audit).',
        );
      }
    }

    // Stripe publishable key (optional, but if set it must match the mode).
    const stripePublishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (stripePublishable) {
      if (stripeLiveMode) {
        if (!stripePublishable.startsWith('pk_live_')) {
          errors.push(
            'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) when STRIPE_LIVE_MODE=true.',
          );
        }
      } else {
        if (!stripePublishable.startsWith('pk_test_')) {
          errors.push(
            'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a test key (pk_test_...) when STRIPE_LIVE_MODE is unset/false.',
          );
        }
      }
    }

    // Stripe webhook signing secret — `whsec_` prefix in both Stripe modes.
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!webhookSecret.startsWith('whsec_')) {
      errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_" in production.');
    }

    // HTTPS-only URLs (hosted mode runs on revealui.com).
    if (!publicUrl.startsWith('https://')) {
      errors.push('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production.');
    }
    if (!nextPublicUrl.startsWith('https://')) {
      errors.push('NEXT_PUBLIC_SERVER_URL must use HTTPS in production.');
    }

    // Cron secret length (hosted-only — Forge customers don't have crons
    // calling back into revealui.com).
    const cronSecret = env.REVEALUI_CRON_SECRET ?? '';
    if (cronSecret.length < 32) {
      errors.push('REVEALUI_CRON_SECRET must be at least 32 characters.');
    }

    // Alert email format (hosted-only — primary use is unreconciled Stripe
    // webhooks; Forge customers can configure but aren't required to).
    const alertEmail = env.REVEALUI_ALERT_EMAIL ?? '';
    if (!alertEmail.includes('@')) {
      errors.push(
        `REVEALUI_ALERT_EMAIL is not a valid email (got: ${JSON.stringify(alertEmail)}).`,
      );
    }

    // CORS_ORIGIN is comma-separated; every origin must be HTTPS in hosted prod.
    const nonHttpsOrigins = (env.CORS_ORIGIN ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0 && !o.startsWith('https://'));
    if (nonHttpsOrigins.length > 0) {
      errors.push(
        `CORS_ORIGIN must contain only HTTPS origins in production. Got non-HTTPS: ${nonHttpsOrigins.join(', ')}.`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`STARTUP VALIDATION FAILED:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Boot-time license enforcement for self-hosted (Forge) deployments.
 *
 * The hosted SaaS deployment (apps/api on Vercel for revealui.com) signs
 * license JWTs for paying subscribers, so REVEALUI_LICENSE_PRIVATE_KEY is
 * always set there — entitlement comes from `account_entitlements` rows,
 * not from an env-var JWT. Boot-time license enforcement is a no-op in
 * that mode.
 *
 * Self-hosted Forge customer deployments don't have the studio's signing
 * key — they only consume a JWT signed by the studio, plus the matching
 * public key. We detect Forge mode by the absence of
 * REVEALUI_LICENSE_PRIVATE_KEY and, when in that mode:
 *
 *   - REVEALUI_LICENSE_KEY must be set (the studio-issued JWT)
 *   - REVEALUI_LICENSE_PUBLIC_KEY must be set (master verification key)
 *   - The JWT must verify cleanly (signature + expiry, with the
 *     subscription grace window from `@revealui/core/license`)
 *
 * Throws on any failure so the API refuses to boot rather than silently
 * degrading to free tier (which is `initializeLicense`'s default
 * behavior). This is the gate that makes a stamped Forge kit honor its
 * license — without it, an expired or tampered key would still let the
 * stack come up.
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build contexts and tests
 * can compile without live credentials present. Takes `env` as an
 * argument (defaulted to `process.env`) so tests can pass explicit
 * fixtures.
 */
export async function validateLicenseAtStartup(env: EnvMap = process.env as EnvMap): Promise<void> {
  if (env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  // Mode detection: absence of the signing key = self-hosted Forge customer.
  if (detectDeploymentMode(env) !== 'forge') {
    return;
  }

  if (!env.REVEALUI_LICENSE_KEY) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is required for Forge deployments. ' +
        'Run bin/revvault-bootstrap.sh to materialize docker/.env from revvault, ' +
        'or contact the operator who stamped this kit.',
    );
  }
  if (!env.REVEALUI_LICENSE_PUBLIC_KEY) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_PUBLIC_KEY is required for Forge deployments. ' +
        'Stamped kits embed this value in docker/.env.example; check that it survived the bootstrap step.',
    );
  }

  // Restore real newlines if the public key landed as a single-line PEM
  // (the .env-encoded format that stamp.sh produces).
  const publicKey = env.REVEALUI_LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n');
  const payload = await validateLicenseKey(env.REVEALUI_LICENSE_KEY, publicKey);
  if (!payload) {
    throw new Error(
      'LICENSE VALIDATION FAILED: REVEALUI_LICENSE_KEY is invalid, expired beyond grace, ' +
        'or signed with a key that does not match REVEALUI_LICENSE_PUBLIC_KEY. ' +
        'Contact the operator who stamped this kit to re-issue the license.',
    );
  }
}

/**
 * Emitted once per cold start when running in production with
 * `STRIPE_LIVE_MODE` unset/false. Made loud + visible so a quick scan of
 * Vercel runtime logs (or a console pull) makes the test-mode posture
 * unmistakable. Exported separately so tests can spy on the emission.
 */
export function emitStripeTestModeWarning(): void {
  const banner = [
    '',
    '⚠️  ╔══════════════════════════════════════════════════════════════════╗',
    '⚠️  ║  STRIPE TEST MODE in production                                  ║',
    '⚠️  ║                                                                  ║',
    '⚠️  ║  STRIPE_LIVE_MODE is unset/false. apps/api accepts test Stripe   ║',
    '⚠️  ║  keys (sk_test_*, pk_test_*) and NO real customer money flows   ║',
    '⚠️  ║  through these endpoints. The Stripe SDK will route requests to ║',
    '⚠️  ║  the test environment.                                           ║',
    '⚠️  ║                                                                  ║',
    '⚠️  ║  Flip STRIPE_LIVE_MODE=true ONLY after the billing-readiness     ║',
    '⚠️  ║  audit (revealui-jv GAP-124) closes — every money-touching path ║',
    '⚠️  ║  must be bulletproof first.                                      ║',
    '⚠️  ╚══════════════════════════════════════════════════════════════════╝',
    '',
    '',
  ].join('\n');
  // Direct stderr write (rather than the standard console facade) per
  // the project's noConsole lint rule. Semantically this is a warning,
  // and stderr is the canonical destination — Vercel captures it as a
  // runtime log identically to a higher-level warning facade.
  process.stderr.write(banner);
}
