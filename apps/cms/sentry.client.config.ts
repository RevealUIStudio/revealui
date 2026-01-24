/**
 * Sentry Client Configuration
 * This file configures Sentry for client-side error tracking
 */

export {
  // Sentry client configuration
  // Only loads if @sentry/nextjs is installed
}
;(async () => {
  try {
    const Sentry = await import('@sentry/nextjs')
    const { sentryConfig } = await import('./src/lib/config/sentry')

    Sentry.init({
      ...sentryConfig,
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Integrations for browser
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    })
  } catch {
    // Sentry not installed, skip initialization
  }
})()
