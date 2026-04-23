import { validateAndThrow } from '@revealui/config';

export type EnvMap = Record<string, string | undefined>;

const REQUIRED_ALWAYS = ['POSTGRES_URL', 'NODE_ENV'] as const;

const REQUIRED_IN_PRODUCTION = [
  'REVEALUI_SECRET',
  'REVEALUI_KEK',
  'REVEALUI_PUBLIC_SERVER_URL',
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
 * Three layers:
 *  1. Presence — required vars are set
 *  2. Production presence — extra prod-required vars are set
 *  3. Production format — `validateAndThrow` from `@revealui/config` enforces
 *     `sk_live_` prefix, `https://` URLs, KEK hex length, URL parity, etc.
 *     Plus inline checks for prod vars that are not in the config schema.
 *
 * Honors `SKIP_ENV_VALIDATION=true` so Docker-build and other build-only
 * contexts can compile without live credentials present.
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

  const missingProd = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
  if (missingProd.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED: Missing production-required env vars: ${missingProd.join(', ')}.`,
    );
  }

  // Format validation via @revealui/config Zod schema + environment checks.
  // Catches sk_live_/sk_test_ mode drift, non-HTTPS public URLs, KEK not
  // 64-hex, URL mismatches, invalid email formats, etc. Throws with a
  // detailed report built by formatValidationErrors().
  validateAndThrow(env as Record<string, string>);

  // Inline checks for prod-required vars that are absent from the config
  // schema or not covered by `validateEnvironment`.
  const alertEmail = env.REVEALUI_ALERT_EMAIL ?? '';
  if (!alertEmail.includes('@')) {
    throw new Error(
      `STARTUP VALIDATION FAILED: REVEALUI_ALERT_EMAIL is not a valid email (got: ${JSON.stringify(alertEmail)}).`,
    );
  }

  const cronSecret = env.REVEALUI_CRON_SECRET ?? '';
  if (cronSecret.length < 32) {
    throw new Error(
      'STARTUP VALIDATION FAILED: REVEALUI_CRON_SECRET must be at least 32 characters.',
    );
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error(
      'STARTUP VALIDATION FAILED: STRIPE_WEBHOOK_SECRET must start with "whsec_" in production.',
    );
  }

  // CORS_ORIGIN is comma-separated; every origin must be HTTPS in prod.
  const nonHttpsOrigins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && !o.startsWith('https://'));
  if (nonHttpsOrigins.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED: CORS_ORIGIN must contain only HTTPS origins in production. Got non-HTTPS: ${nonHttpsOrigins.join(', ')}.`,
    );
  }
}
