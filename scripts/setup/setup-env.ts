#!/usr/bin/env tsx
/**
 * Interactive Environment Setup Script
 *
 * Helps you configure all required environment variables
 * Run: pnpm tsx scripts/setup/setup-env.ts
 */

import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, getProjectRoot, prompt } from '../shared/utils.js'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface EnvVars {
  REVEALUI_SECRET?: string
  REVEALUI_PUBLIC_SERVER_URL?: string
  NEXT_PUBLIC_SERVER_URL?: string
  POSTGRES_URL?: string
  BLOB_READ_WRITE_TOKEN?: string
  STRIPE_SECRET_KEY?: string
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  NEXT_PUBLIC_SENTRY_DSN?: string
}

async function setup() {
  try {
    await getProjectRoot(import.meta.url)

    logger.header('Environment Setup Wizard')
    logger.info('This wizard will help you create .env.development.local\n')

    // Check if file already exists
    const envPath = resolve(__dirname, '../.env.development.local')
    if (existsSync(envPath)) {
      const overwrite = await prompt(
        '⚠️  .env.development.local already exists. Overwrite? (y/N): ',
        'n',
      )
      if (overwrite.toLowerCase() !== 'y') {
        logger.success('Setup cancelled. Existing file preserved.\n')
        return
      }
    }

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('SECTION 1: RevealUI CMS Core')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const envVars: EnvVars = {}

    // Generate secret automatically
    const secret = randomBytes(32).toString('hex')
    logger.success(`Generated REVEALUI_SECRET: ${secret.substring(0, 20)}...\n`)
    envVars.REVEALUI_SECRET = secret

    envVars.REVEALUI_PUBLIC_SERVER_URL =
      (await prompt(
        'REVEALUI_PUBLIC_SERVER_URL [http://localhost:4000]: ',
        'http://localhost:4000',
      )) || 'http://localhost:4000'

    envVars.NEXT_PUBLIC_SERVER_URL = envVars.REVEALUI_PUBLIC_SERVER_URL

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('SECTION 2: Database')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    logger.info('📝 Get from: https://neon.tech → Dashboard → Connection String\n')
    envVars.POSTGRES_URL = await prompt('POSTGRES_URL: ')

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('SECTION 3: Vercel Blob Storage')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    logger.info('📝 Get from: https://vercel.com/dashboard → Storage → Blob → Create Token\n')
    logger.warning('⚠️  CRITICAL: Required for media uploads in production!\n')
    envVars.BLOB_READ_WRITE_TOKEN = await prompt('BLOB_READ_WRITE_TOKEN: ')

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('SECTION 4: Stripe Payments')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    logger.info('📝 Get from: https://dashboard.stripe.com → Developers → API Keys\n')
    logger.info('💡 Use TEST keys for development (sk_test_... and pk_test_...)\n')

    envVars.STRIPE_SECRET_KEY = await prompt('STRIPE_SECRET_KEY (sk_test_...): ')
    envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = await prompt(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...): ',
    )
    envVars.STRIPE_WEBHOOK_SECRET = await prompt('STRIPE_WEBHOOK_SECRET (whsec_...): ')

    logger.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('SECTION 5: Optional - Sentry')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const useSentry = await prompt('Configure Sentry error monitoring? (y/N): ', 'n')

    if (useSentry.toLowerCase() === 'y') {
      logger.info('\n📝 Get from: https://sentry.io → Settings → Client Keys\n')
      envVars.NEXT_PUBLIC_SENTRY_DSN = await prompt('NEXT_PUBLIC_SENTRY_DSN: ')
    }

    // Build .env file content
    let envContent = `# ========================================
# REVEALUI FRAMEWORK - ENVIRONMENT VARIABLES
# ========================================
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE

# ========================================
# CORE - REVEALUI CMS
# ========================================

REVEALUI_SECRET=${envVars.REVEALUI_SECRET}
REVEALUI_PUBLIC_SERVER_URL=${envVars.REVEALUI_PUBLIC_SERVER_URL}
NEXT_PUBLIC_SERVER_URL=${envVars.NEXT_PUBLIC_SERVER_URL}

# ========================================
# DATABASE - NEONDB POSTGRES
# ========================================

POSTGRES_URL=${envVars.POSTGRES_URL}

# ========================================
# STORAGE - VERCEL BLOB
# ========================================

BLOB_READ_WRITE_TOKEN=${envVars.BLOB_READ_WRITE_TOKEN}

# ========================================
# PAYMENTS - STRIPE
# ========================================

STRIPE_SECRET_KEY=${envVars.STRIPE_SECRET_KEY}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
STRIPE_WEBHOOK_SECRET=${envVars.STRIPE_WEBHOOK_SECRET}

# ========================================
# NODE ENVIRONMENT
# ========================================

NODE_ENV=development
NODE_OPTIONS=--no-deprecation

`

    if (envVars.NEXT_PUBLIC_SENTRY_DSN) {
      envContent += `# ========================================
# ERROR MONITORING - SENTRY
# ========================================

NEXT_PUBLIC_SENTRY_DSN=${envVars.NEXT_PUBLIC_SENTRY_DSN}

`
    }

    // Write file
    try {
      writeFileSync(envPath, envContent)
      logger.header('Success!')
      logger.success(`Created: .env.development.local`)
      logger.success(`Variables configured: ${Object.keys(envVars).length}`)
      logger.info('\n🎯 NEXT STEPS:\n')
      logger.info('   1. Review .env.development.local')
      logger.info('   2. Run: pnpm install')
      logger.info('   3. Run: cd apps/cms && pnpm dev')
      logger.info('   4. Visit: http://localhost:4000/admin\n')
    } catch (error) {
      logger.error(
        `Error writing .env file: ${error instanceof Error ? error.message : String(error)}`,
      )
      process.exit(1)
    }
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`)
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
    await setup()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
