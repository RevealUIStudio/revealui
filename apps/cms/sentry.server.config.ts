/**
 * Sentry Server Configuration
 * This file configures Sentry for server-side error tracking
 */

export {
  // Sentry server configuration
  // Only loads if @sentry/nextjs is installed
}
;(async () => {
  try {
    const Sentry = await import('@sentry/nextjs')
    const { sentryConfig } = await import('./src/lib/config/sentry')

    Sentry.init({
      ...sentryConfig,
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Server-specific configuration
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    })
  } catch {
    // Sentry not installed, skip initialization
  }
})()
