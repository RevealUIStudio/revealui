'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

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
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h2>Something went wrong!</h2>
          <p>We apologize for the inconvenience. Please try again.</p>
          {error?.digest && (
            <p style={{ fontSize: '12px', color: '#666' }}>Error ID: {error.digest}</p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              cursor: 'pointer',
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
