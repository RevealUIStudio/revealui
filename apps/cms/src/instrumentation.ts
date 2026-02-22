/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 *
 * NOTE: This file must be compatible with Edge Runtime since Next.js
 * may load it in different runtime contexts during build.
 */

export async function register() {
  // Only run in Node.js runtime — skip Edge Runtime and build-time bundling
  if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
    return
  }

  try {
    const [{ logger }, { validateRequiredEnvVars }] = await Promise.all([
      import('@revealui/core/observability/logger'),
      import('@/lib/utils/env-validation'),
    ])

    const environment = process.env.NODE_ENV || 'development'

    try {
      const result = validateRequiredEnvVars({
        failOnMissing: environment === 'production',
        environment,
      })

      if (!result.valid) {
        const message = `Missing required environment variables: ${result.missing.join(', ')}`
        logger.error('Environment validation failed', new Error(message))
        if (environment === 'production') {
          throw new Error(message)
        }
      }

      if (result.warnings.length > 0) {
        logger.warn('Environment validation warnings', { warnings: result.warnings })
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      if (environment === 'production') {
        logger.error('Environment validation failed', err)
        throw error
      } else {
        logger.warn('Environment validation error', { message: err.message })
      }
    }

    if (process.env.NODE_ENV === 'production') {
      logger.info('Application started', {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      })
    }
  } catch (error) {
    // Last-resort fallback — logger itself failed to load, no alternative available
    console.error('[Instrumentation] Failed to initialize:', error) // ai-validator-ignore
  }
}
