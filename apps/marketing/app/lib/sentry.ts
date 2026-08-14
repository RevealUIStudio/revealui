// Sentry client init for the marketing site (Vite + React).
//
// Mirrors the privacy commitments documented in apps/marketing/app/content/legal/privacy.ts §3
// (Sentry as a subprocessor for error tracking) and §4 (no proactive session recording —
// replaysSessionSampleRate stays 0; on-error replay is captured at 1.0 for crash diagnosis only).
//
// The init is a no-op when `VITE_SENTRY_DSN` is absent so the build runs cleanly in dev and
// in production until the owner pastes the DSN into Vercel env. The corresponding CSP allowlist
// for `connect-src` lives in apps/marketing/vercel.json.

import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // No DSN configured. Sentry stays dormant; the SDK is shipped so events can flow
    // the moment a DSN is added to the Vercel env, without redeploying any code.
    return;
  }

  const analyticsConsent =
    typeof document !== 'undefined' && document.cookie.includes('"analytics":true');

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Tracing and replay are analytics-class. Stay at 0 until cookie consent.
    tracesSampleRate: analyticsConsent && import.meta.env.PROD ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: analyticsConsent ? 1.0 : 0,
    // Common low-value noise we never want to page on.
    ignoreErrors: [
      // String substring matches — Sentry treats strings as substring includes.
      'Non-Error promise rejection captured',
      'NetworkError',
      'Failed to fetch',
      // REGEX-CONFIG-BOUNDARY: third-party-API regex string passed to Sentry SDK config.
      // Filters out errors thrown from browser extensions, which we cannot fix.
      /extensions\//i,
    ],
    beforeSend(event) {
      // Never send dev errors to the production Sentry project.
      if (!import.meta.env.PROD) {
        return null;
      }
      // Redact request cookies + auth headers if Sentry inferred them.
      const request = event.request;
      if (request) {
        if (request.cookies) {
          request.cookies = undefined;
        }
        if (request.headers) {
          const redacted: Record<string, string> = {};
          for (const [key, value] of Object.entries(request.headers)) {
            if (key.toLowerCase() === 'authorization') {
              redacted[key] = '[REDACTED]';
            } else {
              redacted[key] = value as string;
            }
          }
          request.headers = redacted;
        }
      }
      return event;
    },
  });
}

/**
 * Reports an error to Sentry if the SDK was initialised. No-op otherwise.
 * Used by the marketing ErrorBoundary's `componentDidCatch` so render errors
 * land in Sentry without crashing the page if the SDK is dormant.
 */
export function captureRenderError(error: Error, info: { componentStack?: string | null }): void {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  Sentry.withScope((scope) => {
    if (info.componentStack) {
      scope.setExtra('componentStack', info.componentStack);
    }
    Sentry.captureException(error);
  });
}
