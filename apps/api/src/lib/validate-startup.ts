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
 *  3. Production format — `sk_live_` prefix, `https://` URLs, `whsec_`
 *     prefix, 64-hex KEK, secret minimum length, URL parity, and HTTPS-only
 *     CORS origins.
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

  const errors: string[] = [];

  // Stripe live mode — key prefix
  const stripeSecretKey = env.STRIPE_SECRET_KEY ?? '';
  if (!stripeSecretKey.startsWith('sk_live_')) {
    errors.push('STRIPE_SECRET_KEY must be a live key (sk_live_...) in production.');
  }

  const stripePublishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (stripePublishable && !stripePublishable.startsWith('pk_live_')) {
    errors.push(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) in production.',
    );
  }

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
