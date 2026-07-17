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

  // Cron endpoint authentication
  REVEALUI_CRON_SECRET: secretSchema.optional(),

  // Audit log HMAC signing key. Consumed by the governed-MCP receipt signer
  // (apps/server/src/lib/mcp-audit.ts) and checked at boot by validate-startup.
  // When set, MCP receipts chain-sign with HMAC-SHA256 using this key. When
  // unset, the signer falls back to REVEALUI_SECRET (schema-required at 32+
  // chars), so a key is always available in any environment that boots. (The
  // main audit path writes unsigned rows since GAP-355 Stage 1; asymmetric
  // per-row signing across all writers is Stage 3.)
  REVEALUI_AUDIT_HMAC_SECRET: secretSchema.optional(),

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

  // License key signing (RSA-2048 PEM)
  REVEALUI_LICENSE_PRIVATE_KEY: z.string().optional(),
  REVEALUI_LICENSE_PUBLIC_KEY: z.string().optional(),

  // Email provider  -  Gmail REST API (preferred, edge-compatible)
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),

  // Onboarding lifecycle email sequence arming gate. Absent or 'false' keeps
  // the daily cron in dry-run: it records would-send decisions but never calls
  // the mailer. Set to 'true' only after the no-reply mailbox and an
  // end-to-end email delivery verification are both in place.
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
  REVEALUI_BRAND_PRIMARY_COLOR: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a hex color (e.g. #ea580c)')
    .optional(),
  REVEALUI_SHOW_POWERED_BY: z.enum(['true', 'false']).optional(),

  // Fleet-kit branding aliases — stamped kits use these names; they resolve to
  // REVEALUI_BRAND_NAME and REVEALUI_BRAND_PRIMARY_COLOR when the canonical vars
  // are absent.
  REVEALUI_TENANT_NAME: z.string().optional(),
  REVEALUI_TENANT_BRAND: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a hex color (e.g. #1a56db)')
    .optional(),

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
