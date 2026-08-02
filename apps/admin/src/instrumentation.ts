/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 *
 * NOTE: This file must be compatible with Edge Runtime since Next.js
 * may load it in different runtime contexts during build.
 */

export async function register() {
  // Sentry initialization — load runtime-specific config FIRST so server
  // actions / RSC / route handlers / middleware are instrumented before
  // any other module runs. Pattern per getsentry/sentry-for-ai
  // skills/sentry-nextjs-sdk/SKILL.md. Wrapped in try/catch: the
  // instrumentation.ts contract is "never throw — it kills the runtime".
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('../sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('../sentry.edge.config');
    }
  } catch (err) {
    process.stderr.write(
      `Sentry init failed (non-fatal): ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }

  // Only run in the Node.js runtime  -  Edge loads this file during build analysis.
  if ('EdgeRuntime' in globalThis) {
    return;
  }

  // ── Forge boot license enforcement ─────────────────────────────────
  // Shared with apps/server via @revealui/core/revforge-license-boot
  // (fleet-redundancy 2026-08-02). Hosted is a no-op; Forge hard-fails on
  // missing/invalid customer JWT (GAP-260 / GAP-436).
  //
  // process.exit(1) rather than throw: Next.js instrumentation contract is
  // "never throw — it kills the entire runtime". exit(1) is the intentional kill.
  try {
    const { validateForgeLicenseAtStartup } = await import('@revealui/core/revforge-license-boot');
    await validateForgeLicenseAtStartup(process.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
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

        // Per revealui#836: missing critical env vars (notably REVEALUI_KEK)
        // in production MUST fail-fast so the deploy surfaces the error in
        // Vercel deploy logs rather than booting into a broken state (e.g.
        // encryptApiKey throws on first request to /api/user/api-keys/value).
        // SKIP_ENV_VALIDATION=true is the documented escape hatch and
        // matches the RevForge license-validation block above.
        //
        // process.exit(1) is the *intentional* kill (vs throw, which the
        // surrounding try/catch swallows per Next.js instrumentation
        // contract — "never throw, it kills the runtime").
        if (environment === 'production' && process.env.SKIP_ENV_VALIDATION !== 'true') {
          process.stderr.write(
            `ENV VALIDATION FAILED in production:\n  - ${result.missing.join('\n  - ')}\n`,
          );
          process.exit(1);
        }
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

  // ── GAP-214: deterministic boot-time engine init (self-hosted Forge kits) ──
  // The first-admin seeder (config.onInit in apps/admin/revealui.config.ts) only
  // fires when the engine is initialized AND RevealUIInstance treats this as
  // runtime rather than build-time. On a Forge kit (NODE_ENV=production) the
  // engine is otherwise initialized lazily on the first request that needs it —
  // too unreliable for seeding the kit's only admin account. Trigger it once,
  // explicitly, at boot instead.
  //
  // getRevealUIInstance → @revealui/core/nextjs → @revealui/db is Node-only, so
  // it lives in a separate module imported ONLY behind NEXT_RUNTIME==='nodejs'.
  // That keeps @revealui/db out of the Edge bundle — the same reason the
  // telemetry transport above uses fetch() instead of importing @revealui/db
  // directly. The dispatch is wrapped so it can never throw out of
  // instrumentation (which would kill the runtime); the eager init itself is
  // gated on RUNTIME_INIT, so hosted/Vercel boot is unchanged.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initEngineAtBoot, installAdminAuditStorage } = await import('./instrumentation-node');
      // GAP-338: install persistent audit storage FIRST, before anything that
      // can emit an audit event runs — otherwise early emits (engine init,
      // first requests) land in the in-memory sink and evaporate.
      await installAdminAuditStorage();
      await initEngineAtBoot();
    } catch (err) {
      process.stderr.write(
        `Boot-time engine init dispatch failed (non-fatal): ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }
}

// Auto-capture server-side request errors (server actions, RSC, route
// handlers, middleware). Requires @sentry/nextjs >= 8.28.0; we have ^10.49.0.
// Pattern per getsentry/sentry-for-ai skills/sentry-nextjs-sdk/SKILL.md.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
