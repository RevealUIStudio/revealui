/**
 * @revealui/config - Environment Variable Schemas
 *
 * Zod schemas for all environment variables with validation rules
 */

import { z } from 'zod'

// =============================================================================
// Base Validators
// =============================================================================

const urlSchema = z.string().url().min(1)
const secretSchema = z.string().min(32, 'Secret must be at least 32 characters')
const postgresUrlSchema = z
  .string()
  .regex(
    /^postgres(ql)?:\/\//,
    'Must be a PostgreSQL connection string (postgresql:// or postgres://)',
  )

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

  // Storage
  BLOB_READ_WRITE_TOKEN: z.string().min(1, 'Blob token is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'Stripe secret key is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'Stripe webhook secret is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'Stripe publishable key is required'),
})

// =============================================================================
// Optional Variables Schemas
// =============================================================================

const optionalSchema = z.object({
  // Admin
  REVEALUI_ADMIN_EMAIL: z.string().email().optional(),
  REVEALUI_ADMIN_PASSWORD: z.string().min(12, 'Password must be at least 12 characters').optional(),

  // CORS
  REVEALUI_CORS_ORIGINS: z.string().optional(),
  REVEALUI_WHITELISTORIGINS: z.string().optional(), // Deprecated

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: urlSchema.optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_DATABASE_URI: postgresUrlSchema.optional(),

  // Electric
  NEXT_PUBLIC_ELECTRIC_SERVICE_URL: z.string().optional(),
  ELECTRIC_SERVICE_URL: z.string().optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: urlSchema.optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Dev Tools
  NEON_API_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_PROXY: z.enum(['0', '1']).optional(),
  SKIP_ONINIT: z.enum(['true', 'false']).optional(),
})

// =============================================================================
// Combined Schema
// =============================================================================

export const envSchema = requiredSchema.merge(optionalSchema)

// =============================================================================
// Environment-Specific Validation
// =============================================================================

export function validateEnvironment(
  env: z.infer<typeof envSchema>,
  nodeEnv: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Production-specific validations
  if (nodeEnv === 'production') {
    if (env.REVEALUI_PUBLIC_SERVER_URL && !env.REVEALUI_PUBLIC_SERVER_URL.startsWith('https://')) {
      errors.push('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production')
    }
    if (env.NEXT_PUBLIC_SERVER_URL && !env.NEXT_PUBLIC_SERVER_URL.startsWith('https://')) {
      errors.push('NEXT_PUBLIC_SERVER_URL must use HTTPS in production')
    }
    if (env.STRIPE_SECRET_KEY?.includes('test')) {
      errors.push('STRIPE_SECRET_KEY must be a live key (sk_live_...) in production')
    }
    if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test')) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) in production',
      )
    }
  }

  // Development-specific validations
  if (nodeEnv === 'development' || !nodeEnv) {
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('test')) {
      errors.push('STRIPE_SECRET_KEY should use test key (sk_test_...) in development')
    }
    if (
      env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('test')
    ) {
      errors.push(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should use test key (pk_test_...) in development',
      )
    }
  }

  // URL matching validation
  if (
    env.REVEALUI_PUBLIC_SERVER_URL &&
    env.NEXT_PUBLIC_SERVER_URL &&
    env.REVEALUI_PUBLIC_SERVER_URL !== env.NEXT_PUBLIC_SERVER_URL
  ) {
    errors.push('REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL should match')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// =============================================================================
// Type Exports
// =============================================================================

export type EnvConfig = z.infer<typeof envSchema>
export type RequiredEnv = z.infer<typeof requiredSchema>
export type OptionalEnv = z.infer<typeof optionalSchema>
