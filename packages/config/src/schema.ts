/**
 * @revealui/config - Environment Variable Schemas
 *
 * Zod schemas for all environment variables with validation rules
 */

import { z } from 'zod/v4';

// =============================================================================
// Base Validators
// =============================================================================

const urlSchema = z.url().min(1);
const secretSchema = z.string().min(32, 'Secret must be at least 32 characters');

// REGEX-CONFIG-BOUNDARY: Zod format constraint for CSS hex colors. Shared by
// every brand color that may be written into HTML. Not a security scanner.
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

export function cssHexColorSchema(example: string): z.ZodString {
  return z.string().regex(HEX_COLOR_PATTERN, `Must be a hex color (e.g. ${example})`);
}

/** Self-hosted admin faces. Mapped to their Variable family names at render time. */
export const TENANT_FONT_VALUES = ['Inter', 'Inter Tight'] as const;
export const tenantFontValueSchema = z.enum(TENANT_FONT_VALUES);

/**
 * Brand-on token. Hex and the keywords `white` / `black` are CSS colors.
 * `z.stringbool()` accepts boolean spellings including `on` / `off` and
 * yields a real boolean so the raw token is never copied into CSS.
 */
export const tenantBrandOnValueSchema = z.union([
  cssHexColorSchema('#0f172a'),
  z.enum(['white', 'black']),
  z.stringbool(),
]);

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function optionalBlank<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional());
}

const postgresUrlSchema = z
  .string()
  .regex(
    /^postgres(ql)?:\/\//,
    'Must be a PostgreSQL connection string (postgresql:// or postgres://)',
  );

// =============================================================================
// Required Variables Schemas
// =============================================================================

const requiredSchema = z.object({
  // RevealUI Core
  REVEALUI_SECRET: secretSchema,
  REVEALUI_PUBLIC_SERVER_URL: urlSchema,
  NEXT_PUBLIC_SERVER_URL: urlSchema,

  // Database
  POSTGRES_URL: postgresUrlSchema,

  // Storage — Cloudflare R2 is the canonical (and sole) object-storage backend
  // (GAP-208). All five R2 vars must be set together for the R2 provider to
  // activate. The legacy Vercel Blob fallback was removed in #1644 once R2 was
  // confirmed in every production environment.
  R2_ACCOUNT_ID: z.string().min(1, 'R2 account ID is required').optional(),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2 access key ID is required').optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 secret access key is required').optional(),
  R2_BUCKET: z.string().min(1, 'R2 bucket name is required').optional(),
  R2_PUBLIC_BASE_URL: z.string().min(1, 'R2 public base URL is required').optional(),

  // Stripe (optional  -  not all apps have checkout)
  STRIPE_SECRET_KEY: z.string().min(1, 'Stripe secret key is required').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'Stripe webhook secret is required').optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'Stripe publishable key is required')
    .optional(),
});

// =============================================================================
// Optional Variables Schemas
// =============================================================================

const optionalSchema = z.object({
  // Admin
  REVEALUI_ADMIN_EMAIL: z.string().email().optional(),
  REVEALUI_ADMIN_PASSWORD: z.string().min(12, 'Password must be at least 12 characters').optional(),

  // Field-level encryption key  -  exactly 64 hex characters (32 bytes / 256 bits)
  REVEALUI_KEK: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'Must be exactly 64 hex characters')
    .optional(),

  // Transitional encryption key for zero-downtime KEK rotation.
  // When set: new encrypts use _NEXT, decrypts try _NEXT first then fall
  // back to REVEALUI_KEK on GCM auth-tag mismatch. After the rotation tool
  // re-encrypts every row, the operator promotes _NEXT → REVEALUI_KEK and
  // removes _NEXT. See docs/runbooks/rotate-kek.md §Zero-downtime path.
  REVEALUI_KEK_NEXT: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'Must be exactly 64 hex characters')
    .optional(),

  // Cron endpoint authentication. PREVIOUS is the overlap slot for zero-downtime
  // rotation (docs/security/gap-016-cron-secret-rotation.md). Unset in steady state.
  REVEALUI_CRON_SECRET: secretSchema.optional(),
  REVEALUI_CRON_SECRET_PREVIOUS: secretSchema.optional(),

  // Audit-log signing key (GAP-355 Stage 3): the Ed25519 private key (PKCS#8
  // PEM) that signs every audit row at the write door. Validated as a real
  // Ed25519 key at boot by validate-startup, which refuses to serve a signing
  // deployment without it (no REVEALUI_SECRET fallback — the legacy HMAC secret
  // was retired). `REVEALUI_AUDIT_SIGNING_KID` is the self-asserted key id
  // embedded in each signature; when unset, a stable key-bound id is derived.
  REVEALUI_AUDIT_SIGNING_KEY: z.string().optional(),
  REVEALUI_AUDIT_SIGNING_KID: z.string().optional(),

  // Log retention window for app_logs + error_events (days). Default 90.
  // Privacy policy commits to a concrete window; see docs/security/.
  REVEALUI_LOG_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Must not exceed 3650 days (10 years)')
    .default(90),

  // Operational-hygiene retention windows (days). Purge terminal rows past
  // the window to keep hot tables lean. See packages/db/src/cleanup/
  // operational-retention.ts.
  REVEALUI_JOB_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Must not exceed 3650 days (10 years)')
    .default(30),
  REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Must not exceed 3650 days (10 years)')
    .default(90),
  // Resolved rows only — unresolved (open customer-payment bugs) never purged.
  REVEALUI_WEBHOOK_RECONCILIATION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Must not exceed 3650 days (10 years)')
    .default(90),

  // License key signing (Ed25519 PEM)
  REVEALUI_LICENSE_PRIVATE_KEY: z.string().optional(),
  REVEALUI_LICENSE_PUBLIC_KEY: z.string().optional(),
  // GAP-260 P4-1: explicit hosted vs forge posture (fallback: private-key presence)
  REVEALUI_DEPLOYMENT_MODE: z.enum(['hosted', 'forge']).optional(),

  // Email provider  -  Gmail REST API (preferred, edge-compatible)
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_WIF_PROVIDER: z.string().min(1).optional(),
  GOOGLE_WIF_AUDIENCE: z.string().min(1).optional(),
  GOOGLE_WIF_ID_TOKEN: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),

  // Onboarding lifecycle email sequence. Hosted test/staging arms when the
  // Gmail mailbox path is present. Production (main) stays disarmed unless
  // this is exactly 'true' after an owner delivery check. 'false' disables
  // even on hosted test. Absent mailbox credentials fail closed.
  LIFECYCLE_EMAILS_ENABLED: z.enum(['true', 'false']).optional(),

  // CORS
  CORS_ORIGIN: z.string().optional(), // API: comma-separated allowed origins (required in production)
  REVEALUI_CORS_ORIGINS: z.string().optional(), // admin: comma-separated allowed origins (alias for CORS_ORIGIN)
  REVEALUI_WHITELISTORIGINS: z.string().optional(), // Deprecated  -  use CORS_ORIGIN

  // Database
  DATABASE_URL: postgresUrlSchema.optional(), // Fallback for POSTGRES_URL

  // Electric
  NEXT_PUBLIC_ELECTRIC_SERVICE_URL: z.string().optional(),
  ELECTRIC_SERVICE_URL: z.string().optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: urlSchema.optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Signup Gating
  REVEALUI_SIGNUP_WHITELIST: z.string().optional(),
  REVEALUI_SIGNUP_OPEN: z.enum(['true', 'false']).optional(),

  // Dev Tools
  NEON_API_KEY: z.string().optional(),
  STRIPE_PROXY: z.enum(['0', '1']).optional(),
  SKIP_ONINIT: z.enum(['true', 'false']).optional(),

  // Branding (Enterprise white-label)
  REVEALUI_BRAND_NAME: z.string().optional(),
  REVEALUI_BRAND_LOGO_URL: z.string().optional(),
  REVEALUI_BRAND_PRIMARY_COLOR: cssHexColorSchema('#ea580c').optional(),
  REVEALUI_SHOW_POWERED_BY: z.enum(['true', 'false']).optional(),

  // Fleet-kit branding aliases — stamped kits use these names; they resolve to
  // REVEALUI_BRAND_NAME and REVEALUI_BRAND_PRIMARY_COLOR when the canonical vars
  // are absent.
  REVEALUI_TENANT_NAME: z.string().optional(),
  REVEALUI_TENANT_BRAND: cssHexColorSchema('#1a56db').optional(),
  // Foreground used on the brand fill. Boolean/on (`z.stringbool`, whose
  // truthy set includes "on") selects the constant white; falsy omits the
  // variable. A hex uses the same Zod constraint as the brand color. The
  // keywords `white` and `black` are an allowlist, not free text. Blank is
  // unset. Anything else fails validation and must not be written into CSS.
  REVEALUI_TENANT_BRAND_ON: optionalBlank(tenantBrandOnValueSchema),
  // Self-hosted faces only. Other family names are rejected so they cannot
  // be interpolated into the admin style block.
  REVEALUI_TENANT_FONT: optionalBlank(tenantFontValueSchema),

  // License
  REVEALUI_LICENSE_KEY: z.string().optional(),
});

// =============================================================================
// Combined Schema
// =============================================================================

export const envSchema = requiredSchema.merge(optionalSchema);

// =============================================================================
// Environment-Specific Validation
// =============================================================================

export function validateEnvironment(
  env: z.infer<typeof envSchema>,
  nodeEnv: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Production-specific validations
  if (nodeEnv === 'production') {
    if (env.REVEALUI_PUBLIC_SERVER_URL && !env.REVEALUI_PUBLIC_SERVER_URL.startsWith('https://')) {
      errors.push('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production');
    }
    if (env.NEXT_PUBLIC_SERVER_URL && !env.NEXT_PUBLIC_SERVER_URL.startsWith('https://')) {
      errors.push('NEXT_PUBLIC_SERVER_URL must use HTTPS in production');
    }
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      errors.push('STRIPE_SECRET_KEY must be a live key (sk_live_...) in production');
    }
    if (
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')
    ) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) in production',
      );
    }
  }

  // Development-specific validations
  if (nodeEnv === 'development' || !nodeEnv) {
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      errors.push('STRIPE_SECRET_KEY should use test key (sk_test_...) in development');
    }
    if (
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')
    ) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should use test key (pk_test_...) in development',
      );
    }
  }

  // URL matching validation
  if (
    env.REVEALUI_PUBLIC_SERVER_URL &&
    env.NEXT_PUBLIC_SERVER_URL &&
    env.REVEALUI_PUBLIC_SERVER_URL !== env.NEXT_PUBLIC_SERVER_URL
  ) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL should match');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Type Exports
// =============================================================================

export type EnvConfig = z.infer<typeof envSchema>;
export type RequiredEnv = z.infer<typeof requiredSchema>;
export type OptionalEnv = z.infer<typeof optionalSchema>;
