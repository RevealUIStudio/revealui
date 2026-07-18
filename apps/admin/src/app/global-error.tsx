'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { apiFetch } from '@/lib/utils/csrf';
// global-error.tsx replaces the root layout on error, so it renders outside every
// route group and gets none of their CSS. (backend)/custom.css supplies `@import
// "tailwindcss"` and the @theme bridge from --color-* to var(--rvui-*), but it does NOT
// define the --rvui-* values themselves. Those live in tokens.css, loaded separately by
// (backend)/layout.tsx. Import both, in the same order (backend)/layout.tsx does, so the
// var() references actually resolve instead of hitting an undefined custom property.
import '@revealui/presentation/tokens.css';
import './(backend)/custom.css';

// No InitTheme/data-theme script runs here (global-error has no layout to host one), so
// this page follows tokens.css's own prefers-color-scheme handling with no explicit
// override: dark by default, light only when the OS signals a light preference. That's
// an accepted trade-off for an error page rather than a bug. Wiring theme persistence
// into a component that exists to survive a broken render tree is its own risk, and a
// rare last-resort error screen doesn't need to track the user's saved preference.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send to Sentry (client SDK; uses NEXT_PUBLIC_SENTRY_DSN). Pattern
    // per getsentry/sentry-for-ai skills/sentry-nextjs-sdk/SKILL.md.
    // Fire-and-forget; the SDK handles transport + retry internally.
    Sentry.captureException(error);

    // Also POST to admin's server-side log transport (separate from Sentry).
    // Fire-and-forget  -  never let capture failure affect the error UI.
    // Route through the admin server-side proxy (same origin) which adds the
    // X-Internal-Token header. Sending REVEALUI_SECRET from the client would
    // expose it in the browser bundle.
    apiFetch('/api/capture-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'fatal',
        message: error?.message ?? 'Unknown client error',
        stack: error?.stack,
        app: 'admin',
        context: 'client',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        metadata: error?.digest ? { digest: error.digest } : undefined,
      }),
    }).catch(() => {
      // Intentionally silent  -  capturing errors must never throw
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="size-7 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            We apologize for the inconvenience. Our team has been notified. Please try again.
          </p>
          {error?.digest && (
            <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
