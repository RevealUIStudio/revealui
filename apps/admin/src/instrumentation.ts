/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 *
 * NOTE: This file must be compatible with Edge Runtime since Next.js
 * may load it in different runtime contexts during build.
 */

export async function register() {
  // Only run in the Node.js runtime  -  Edge loads this file during build analysis.
  if ('EdgeRuntime' in globalThis) {
    return;
  }

  try {
    const [{ logger }, { validateRequiredEnvVars }, { configureClientIp }] = await Promise.all([
      import('@revealui/core/observability/logger'),
      import('@/lib/utils/env-validation'),
      import('@revealui/security'),
    ]);

    // Configure trusted-proxy-aware client IP extraction for session-binding
    // validation. See GAP-130 + packages/security/src/request-ip.ts.
    // trustedProxyCount: 1 reflects the current Vercel-only proxy chain. Bump
    // to 2 in the SAME PR as Cloudflare orange-cloud cutover (GAP-133 phases 5-6).
    configureClientIp({ trustedProxyCount: 1 });

    const environment = process.env.NODE_ENV || 'development';

    // Initialize license cache so feature gates work immediately on cold start.
    // Without this, isFeatureEnabled() defaults to 'free' until a sign-in route
    // triggers initializeLicense() lazily  -  causing Pro users to be denied on
    // the first request to AI routes after a cold deploy.
    try {
      const { initializeLicense } = await import('@revealui/core/license');
      await initializeLicense();
    } catch {
      // Non-fatal  -  license defaults to free tier if initialization fails
    }

    // Never throw from instrumentation  -  it kills the entire runtime
    // Log errors but allow the app to start regardless
    try {
      const result = validateRequiredEnvVars({
        failOnMissing: false,
        environment,
      });

      if (!result.valid) {
        const message = `Missing required environment variables: ${result.missing.join(', ')}`;
        logger.error('Environment validation failed', new Error(message));
      }

      if (result.warnings.length > 0) {
        logger.warn('Environment validation warnings', { warnings: result.warnings });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Environment validation error (non-fatal)', { message: err.message });
    }

    if (process.env.NODE_ENV === 'production') {
      logger.info('Application started', {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      });

      // Wire log transport  -  POST warn+ entries to API (avoids Edge bundling issues).
      // Next.js statically traces ALL imports in instrumentation.ts (even dynamic ones),
      // so we use fetch() instead of importing @revealui/db directly.
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';

      // Circuit breaker: back off on consecutive failures
      let telemetryFailures = 0;
      const maxBackoffFailures = Number(process.env.TELEMETRY_MAX_FAILURES ?? 5);

      logger.addLogHandler((entry) => {
        if (entry.level !== 'warn' && entry.level !== 'error' && entry.level !== 'fatal') return;

        // Circuit breaker: skip if too many consecutive failures
        if (telemetryFailures >= maxBackoffFailures) return;

        const data: Record<string, unknown> = {};
        if (entry.context && Object.keys(entry.context).length > 0) {
          // Copy only safe keys  -  never forward credentials or prototype-poisoning keys
          const BlockedKeys = new Set([
            'password',
            'secret',
            'token',
            'apiKey',
            'api_key',
            '__proto__',
            'constructor',
            'prototype',
          ]);
          for (const [k, v] of Object.entries(entry.context)) {
            if (!BlockedKeys.has(k)) data[k] = v;
          }
        }
        if (entry.error) data.error = entry.error;
        fetch(`${apiUrl}/api/logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': process.env.REVEALUI_SECRET ?? '',
          },
          body: JSON.stringify({
            level: entry.level,
            message: entry.message,
            app: 'admin',
            environment: 'production',
            requestId: entry.context?.requestId,
            userId: entry.context?.userId,
            data: Object.keys(data).length > 0 ? data : undefined,
          }),
        })
          .then(() => {
            telemetryFailures = 0; // reset on success
          })
          .catch((err: unknown) => {
            telemetryFailures++;
            if (telemetryFailures === maxBackoffFailures) void err;
          });
      });

      // Keep instrumentation Edge-safe. Process-level crash hooks belong in an
      // explicitly Node-only runtime surface, not Next's shared instrumentation
      // entrypoint, which Turbopack statically analyzes for Edge compatibility.
      logger.info('admin telemetry transport initialized', {
        apiUrl,
        processCapture: 'disabled-in-instrumentation',
      });
    }
  } catch (error) {
    void error;
  }
}
