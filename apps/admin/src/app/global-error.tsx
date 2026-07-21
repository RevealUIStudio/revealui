'use client';

import * as Sentry from '@sentry/nextjs';
import { Button, IconAlertTriangle } from '@revealui/presentation/server';
import { useEffect } from 'react';
import { apiFetch } from '@/lib/utils/csrf';
// global-error.tsx replaces the root layout on error, so it renders outside every
// route group and gets none of their CSS. Reuse (backend)'s Tailwind entry (tailwindcss
// + tokens.css + the cobalt @theme bridge) so the branded classes below actually resolve.
import './(backend)/custom.css';

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
            <IconAlertTriangle className="size-7 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            We apologize for the inconvenience. Our team has been notified. Please try again.
          </p>
          {error?.digest && (
            <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
          )}
          <Button type="button" variant="brand" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
