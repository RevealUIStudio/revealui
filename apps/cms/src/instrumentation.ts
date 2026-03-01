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

    // Never throw from instrumentation — it kills the entire runtime
    // Log errors but allow the app to start regardless
    try {
      const result = validateRequiredEnvVars({
        failOnMissing: false,
        environment,
      })

      if (!result.valid) {
        const message = `Missing required environment variables: ${result.missing.join(', ')}`
        logger.error('Environment validation failed', new Error(message))
      }

      if (result.warnings.length > 0) {
        logger.warn('Environment validation warnings', { warnings: result.warnings })
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.warn('Environment validation error (non-fatal)', { message: err.message })
    }

    if (process.env.NODE_ENV === 'production') {
      logger.info('Application started', {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      })

      // Server-side error capture — POST unhandled rejections to the API error endpoint.
      // Avoids importing @revealui/db here (native sharp module breaks Edge bundle).
      // Fire-and-forget: never let capture failure crash the process.
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com'
      process.on('unhandledRejection', (reason: unknown) => {
        const err = reason instanceof Error ? reason : new Error(String(reason))
        logger.error('Unhandled rejection in CMS server', err)
        fetch(`${apiUrl}/api/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'error',
            message: err.message,
            stack: err.stack,
            app: 'cms',
            context: 'server',
            environment: process.env.NODE_ENV ?? 'production',
          }),
        }).catch(() => {
          // Last resort — API unreachable, Axiom log drain will still capture it
        })
      })
    }
  } catch (error) {
    // Last-resort fallback — logger itself failed to load, no alternative available
    console.error('[Instrumentation] Failed to initialize:', error) // ai-validator-ignore
  }
}
