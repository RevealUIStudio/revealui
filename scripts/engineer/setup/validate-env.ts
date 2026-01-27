#!/usr/bin/env tsx

/**
 * Environment Variable Validation Script
 *
 * Validates that all required environment variables are set and follow naming conventions
 * Run before starting development or deployment
 *
 * Usage:
 *   pnpm tsx scripts/setup/validate-env.ts
 *   # or
 *   pnpm validate:env
 */

import {config} from 'dotenv'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createLogger,getProjectRoot} from '../shared/utils.ts'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: resolve(__dirname, '../.env.development.local') })

// Required variables (must be present)
const required: string[] = [
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'POSTGRES_URL',
  'BLOB_READ_WRITE_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
]

// Optional variables (documented but not required)
const optional: string[] = [
  'REVEALUI_ADMIN_EMAIL',
  'REVEALUI_ADMIN_PASSWORD',
  'REVEALUI_CORS_ORIGINS',
  'REVEALUI_WHITELISTORIGINS', // Deprecated but still supported
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_DATABASE_URI',
  'NEXT_PUBLIC_ELECTRIC_SERVICE_URL',
  'ELECTRIC_SERVICE_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'NEON_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_PROXY',
  'SKIP_ONINIT',
]

// Naming convention patterns
const namingConventions = {
  revealUI: /^REVEALUI_/, // RevealUI-specific server-side variables
  nextPublic: /^NEXT_PUBLIC_/, // Next.js client-side variables
  standard: /^(STRIPE_|BLOB_|SENTRY_|SUPABASE_|NEON_|ELECTRIC_|SKIP_|NODE_)/, // Standard third-party prefixes
}

async function validateEnvironment() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Environment Variable Validation')

    // Check required variables
    const missing: string[] = []
    const present: string[] = []
    const warnings: string[] = []

    required.forEach((key) => {
      // Special handling for POSTGRES_URL - also check DATABASE_URL as fallback
      if (key === 'POSTGRES_URL') {
        if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) {
          missing.push(key)
        } else {
          present.push(key)
          // Warn if using DATABASE_URL instead of POSTGRES_URL
          if (process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
            warnings.push(
              '⚠️  Using DATABASE_URL instead of POSTGRES_URL (consider standardizing to POSTGRES_URL)',
            )
          }
        }
      } else if (!process.env[key]) {
        missing.push(key)
      } else {
        present.push(key)
      }
    })

    // Check for deprecated variables
    if (process.env.REVEALUI_WHITELISTORIGINS && !process.env.REVEALUI_CORS_ORIGINS) {
      warnings.push('⚠️  REVEALUI_WHITELISTORIGINS is deprecated, use REVEALUI_CORS_ORIGINS instead')
    }

    // Check naming conventions for all env vars
    const allEnvVars = Object.keys(process.env)
    const nonStandardVars = allEnvVars.filter((key) => {
      // Skip Node.js built-in vars
      if (key.startsWith('npm_') || key.startsWith('NPM_')) return false
      if (key === 'NODE_ENV' || key === 'NODE_OPTIONS') return false
      if (key === 'PATH' || key === 'HOME' || key === 'USER') return false

      // Check if it follows any naming convention
      const followsConvention =
        namingConventions.revealUI.test(key) ||
        namingConventions.nextPublic.test(key) ||
        namingConventions.standard.test(key)

      return !followsConvention
    })

    if (nonStandardVars.length > 0) {
      warnings.push(
        `⚠️  Non-standard variable names found (consider using REVEALUI_* or NEXT_PUBLIC_* prefixes): ${nonStandardVars.join(', ')}`,
      )
    }

    // Display results
    if (present.length > 0) {
      logger.success('Required Variables Present:')
      present.forEach((key) => {
        const value = process.env[key] || process.env.DATABASE_URL // For POSTGRES_URL fallback
        const masked =
          key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD')
            ? `${value?.substring(0, 10)}...`
            : value?.substring(0, 50)
        logger.info(`   ${key}: ${masked}`)
      })
      logger.info('')
    }

    // Show optional variables that are set
    const optionalPresent = optional.filter((key) => process.env[key])
    if (optionalPresent.length > 0) {
      logger.info('ℹ️  Optional Variables Present:')
      optionalPresent.forEach((key) => {
        const value = process.env[key]
        const masked =
          key.includes('SECRET') ||
          key.includes('TOKEN') ||
          key.includes('PASSWORD') ||
          key.includes('KEY')
            ? `${value?.substring(0, 10)}...`
            : value?.substring(0, 50)
        logger.info(`   ${key}: ${masked}`)
      })
      logger.info('')
    }

    if (missing.length > 0) {
      logger.error('Missing Required Variables:')
      missing.forEach((key) => {
        logger.error(`   ${key}`)
      })
      logger.error('\n❌ Environment validation FAILED\n')
      logger.info('💡 Fix:')
      logger.info('   1. Copy .env.template to .env.development.local')
      logger.info('   2. Fill in all required values')
      logger.info('   3. Run this script again\n')
      process.exit(1)
    }

    // Validate specific formats
    logger.info('🔍 Validating Formats...\n')

    // Check REVEALUI_SECRET length
    if (process.env.REVEALUI_SECRET && process.env.REVEALUI_SECRET.length < 32) {
      warnings.push('⚠️  REVEALUI_SECRET should be at least 32 characters')
    }

    // Check URLs have protocol
    const urlVars = ['REVEALUI_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_SERVER_URL']
    urlVars.forEach((key) => {
      const url = process.env[key]
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        warnings.push(`⚠️  ${key} should start with http:// or https://`)
      }
    })

    // Check that server URLs match
    if (process.env.REVEALUI_PUBLIC_SERVER_URL && process.env.NEXT_PUBLIC_SERVER_URL) {
      if (process.env.REVEALUI_PUBLIC_SERVER_URL !== process.env.NEXT_PUBLIC_SERVER_URL) {
        warnings.push('⚠️  REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL should match')
      }
    }

    // Check POSTGRES_URL format
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      warnings.push('⚠️  POSTGRES_URL should start with postgresql:// or postgres://')
    }

    // Check Stripe test mode in development
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('test')) {
        warnings.push(
          '⚠️  Using LIVE Stripe key in development! Use test keys (sk_test_...) for local dev',
        )
      }
      if (
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
        !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('test')
      ) {
        warnings.push(
          '⚠️  Using LIVE Stripe publishable key in development! Use test keys (pk_test_...) for local dev',
        )
      }
    }

    // Check production settings
    if (process.env.NODE_ENV === 'production') {
      if (
        process.env.REVEALUI_PUBLIC_SERVER_URL &&
        !process.env.REVEALUI_PUBLIC_SERVER_URL.startsWith('https://')
      ) {
        logger.error('ERROR: Production REVEALUI_PUBLIC_SERVER_URL must use HTTPS')
        process.exit(1)
      }
      if (process.env.STRIPE_SECRET_KEY?.includes('test')) {
        warnings.push(
          '⚠️  Using TEST Stripe key in production! Use live keys (sk_live_...) for production',
        )
      }
    }

    // Display warnings
    if (warnings.length > 0) {
      logger.warning('Warnings:')
      warnings.forEach((warning) => {
        logger.warning(`   ${warning}`)
      })
      logger.info('')
    }

    logger.success('All format validations passed\n')

    // Summary
    logger.header('Environment Validation Successful')
    logger.info(`   Required Variables: ${present.length}/${required.length} present`)
    logger.info(`   Optional Variables: ${optionalPresent.length}/${optional.length} present`)
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    if (warnings.length > 0) {
      logger.info(`   Warnings: ${warnings.length}`)
    }
    logger.info('')
    logger.success('🚀 Ready to start development!')
    logger.info('')
    logger.info('💡 Tip: See .env.template for all available variables and documentation\n')
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await validateEnvironment()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
