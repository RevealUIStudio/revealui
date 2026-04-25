export type EnvMap = Record<string, string | undefined>;

const REQUIRED_ALWAYS = ['POSTGRES_URL', 'NODE_ENV'] as const;

const REQUIRED_IN_PRODUCTION = [
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

/**
 * Validate required environment variables at startup so any missing or
 * misformatted config causes a loud failure at boot rather than silently
 * failing on the first real request.
 *
 * Layers:
 *  1. Presence — required vars are set
 *  2. Production presence — extra prod-required vars are set
 *  3. Production format — `sk_live_`/`sk_test_` prefix (toggle-dependent),
 *     `https://` URLs, `whsec_` prefix, 64-hex KEK, secret minimum length,
 *     URL parity, and HTTPS-only CORS origins.
 *
 * `STRIPE_LIVE_MODE` toggle:
 *   - When `STRIPE_LIVE_MODE=true`: enforces `sk_live_` / `pk_live_` prefixes
 *     (real customer money flows).
 *   - When `STRIPE_LIVE_MODE` is unset or any other value: enforces `sk_test_`
 *     / `pk_test_` prefixes and emits a loud boot-time warning that the API
 *     is running with TEST Stripe keys in production. This is the
 *     pre-launch / pre-LLC / pre-billing-audit posture (gated on GAP-124
 *     in revealui-jv).
 *
 * The toggle is intentionally an env var (not a code constant) so flipping
 * to live mode is a Vercel-side config change rather than a code-deploy
 * coupled to billing readiness. Enforcing prefix parity in BOTH directions
 * (test-mode cannot have live keys, live-mode cannot have test keys) catches
 * half-configured states where someone sets the key but forgets the toggle.
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build and other build-only
 * contexts can compile without live credentials present.
 *
 * Takes `env` as an argument (defaulted to `process.env`) so tests can pass
 * explicit fixtures without touching real process state. All checks read
 * from the `env` argument — they do not fall back to `process.env` — so the
 * function is deterministic under vitest (which sets `NODE_ENV=test`).
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

  const missingProd = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
  if (missingProd.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED: Missing production-required env vars: ${missingProd.join(', ')}.`,
    );
  }

  const stripeLiveMode = env.STRIPE_LIVE_MODE === 'true';
  if (!stripeLiveMode) {
    emitStripeTestModeWarning();
  }

  const errors: string[] = [];

  // Stripe secret key — prefix depends on STRIPE_LIVE_MODE.
  const stripeSecretKey = env.STRIPE_SECRET_KEY ?? '';
  if (stripeLiveMode) {
    if (!stripeSecretKey.startsWith('sk_live_')) {
      errors.push('STRIPE_SECRET_KEY must be a live key (sk_live_...) when STRIPE_LIVE_MODE=true.');
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

  // Stripe webhook signing secret — `whsec_` prefix in both modes (Stripe
  // webhook secrets share the same prefix for test + live; the test/live
  // distinction is the secret material itself, not the prefix).
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!webhookSecret.startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_" in production.');
  }

  // Public URLs — HTTPS only, and parity between api and next
  const publicUrl = env.REVEALUI_PUBLIC_SERVER_URL ?? '';
  if (!publicUrl.startsWith('https://')) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production.');
  }
  const nextPublicUrl = env.NEXT_PUBLIC_SERVER_URL ?? '';
  if (!nextPublicUrl.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SERVER_URL must use HTTPS in production.');
  }
  if (publicUrl && nextPublicUrl && publicUrl !== nextPublicUrl) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL must match in production.');
  }

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

  const cronSecret = env.REVEALUI_CRON_SECRET ?? '';
  if (cronSecret.length < 32) {
    errors.push('REVEALUI_CRON_SECRET must be at least 32 characters.');
  }

  // Alert email must look like an email
  const alertEmail = env.REVEALUI_ALERT_EMAIL ?? '';
  if (!alertEmail.includes('@')) {
    errors.push(`REVEALUI_ALERT_EMAIL is not a valid email (got: ${JSON.stringify(alertEmail)}).`);
  }

  // CORS_ORIGIN is comma-separated; every origin must be HTTPS in prod.
  const nonHttpsOrigins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && !o.startsWith('https://'));
  if (nonHttpsOrigins.length > 0) {
    errors.push(
      `CORS_ORIGIN must contain only HTTPS origins in production. Got non-HTTPS: ${nonHttpsOrigins.join(', ')}.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`STARTUP VALIDATION FAILED:\n  - ${errors.join('\n  - ')}`);
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
