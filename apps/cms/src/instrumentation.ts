/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@revealui/core/utils/logger'
import dotenv from 'dotenv'
import { validateRequiredEnvVars } from '@/lib/utils/env-validation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file from monorepo root before validation
// Next.js automatically loads .env from apps/cms/, but we also need the root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
// Also load .env.local if it exists (has precedence)
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') })
// Load environment-specific files
const envFile = `.env.${process.env.NODE_ENV || 'development'}.local`
dotenv.config({ path: path.resolve(__dirname, `../../../${envFile}`) })

export async function register() {
  // Validate critical environment variables at startup
  const environment = process.env.NODE_ENV || 'development'

  try {
    const result = validateRequiredEnvVars({
      failOnMissing: environment === 'production',
      environment,
    })

    if (!result.valid) {
      const error = new Error(
        `Missing required environment variables: ${result.missing.join(', ')}`,
      )
      logger.error('Environment validation failed', { message: error.message })
      if (environment === 'production') {
        throw error
      } else {
        // In development, warn but don't block startup
        if (result.warnings.length > 0) {
          logger.warn('Environment validation warnings', { warnings: result.warnings })
        }
      }
    } else if (result.warnings.length > 0) {
      logger.warn('Environment validation warnings', { warnings: result.warnings })
    }
  } catch (error) {
    // Re-throw in production, log in development
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (environment === 'production') {
      logger.error('Environment validation failed', { message: errorMessage })
      throw error
    } else {
      logger.warn('Environment validation error', { message: errorMessage })
    }
  }

  // Initialize Vercel Speed Insights if available
  if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
    try {
      await import('@vercel/speed-insights/next')
      // Speed Insights is automatically initialized via the component
    } catch {
      // Speed Insights not installed
    }
  }

  // Initialize structured logging
  if (process.env.NODE_ENV === 'production') {
    logger.info('Application started', {
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
    })
  }
}
