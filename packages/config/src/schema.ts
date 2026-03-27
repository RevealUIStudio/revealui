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

  // Storage (optional — not all apps use Blob storage)
  BLOB_READ_WRITE_TOKEN: z.string().min(1, 'Blob token is required').optional(),

  // Stripe (optional — not all apps have checkout)
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

  // Field-level encryption key — exactly 64 hex characters (32 bytes / 256 bits)
  REVEALUI_KEK: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'Must be exactly 64 hex characters')
    .optional(),

  // Cron endpoint authentication
  REVEALUI_CRON_SECRET: secretSchema.optional(),

  // License key signing (RSA-2048 PEM)
  REVEALUI_LICENSE_PRIVATE_KEY: z.string().optional(),
  REVEALUI_LICENSE_PUBLIC_KEY: z.string().optional(),

  // Email provider — Gmail REST API (preferred, edge-compatible)
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Email provider — Resend (fallback)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Email provider — SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().optional(), // API: comma-separated allowed origins (required in production)
  REVEALUI_CORS_ORIGINS: z.string().optional(), // CMS: comma-separated allowed origins (alias for CORS_ORIGIN)
  REVEALUI_WHITELISTORIGINS: z.string().optional(), // Deprecated — use CORS_ORIGIN

  // Database
  DATABASE_URL: postgresUrlSchema.optional(), // Fallback for POSTGRES_URL (REST) or SUPABASE_DATABASE_URL (vector)
  SUPABASE_DATABASE_URL: postgresUrlSchema.optional(), // Preferred: Supabase vector database connection

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: urlSchema.optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_DATABASE_URI: postgresUrlSchema.optional(),

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
  SUPABASE_SECRET_KEY: z.string().optional(),
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
    if (env.STRIPE_SECRET_KEY?.includes('test')) {
      errors.push('STRIPE_SECRET_KEY must be a live key (sk_live_...) in production');
    }
    if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test')) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) in production',
      );
    }
  }

  // Development-specific validations
  if (nodeEnv === 'development' || !nodeEnv) {
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('test')) {
      errors.push('STRIPE_SECRET_KEY should use test key (sk_test_...) in development');
    }
    if (
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('test')
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
