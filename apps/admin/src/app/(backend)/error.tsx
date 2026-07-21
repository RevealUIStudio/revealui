'use client';

import { Button, IconAlertTriangle } from '@revealui/presentation/server';
import Link from 'next/link';

export default function BackendError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error.message.toLowerCase();
  const isNetworkError =
    message.includes('fetch') || message.includes('network') || message.includes('econnrefused');

  const isDatabaseError =
    message.includes('econnrefused') ||
    message.includes('connection') ||
    message.includes('postgres') ||
    message.includes('database') ||
    message.includes('relation') ||
    message.includes('timeout') ||
    message.includes('enotfound');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <IconAlertTriangle className="size-7 text-destructive" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-semibold text-foreground">
        {isDatabaseError ? 'Database connection failed' : 'Something went wrong'}
      </h2>

      {isDatabaseError ? (
        process.env.NODE_ENV !== 'production' ? (
          <div className="flex max-w-lg flex-col gap-3 text-center text-sm text-muted-foreground">
            <p>The admin dashboard cannot reach the database. To fix this:</p>
            <ol className="list-inside list-decimal text-left text-xs text-muted-foreground">
              <li>
                Set <code className="text-foreground">POSTGRES_URL</code> or{' '}
                <code className="text-foreground">DATABASE_URL</code> in your environment
              </li>
              <li>
                Run <code className="text-foreground">pnpm db:migrate</code> to create tables
              </li>
              <li>
                Run <code className="text-foreground">pnpm db:seed</code> for sample content
              </li>
            </ol>
          </div>
        ) : (
          <p className="max-w-md text-center text-sm text-muted-foreground">
            We're having trouble reaching our systems. Our team has been notified. Please try again
            shortly.
          </p>
        )
      ) : (
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {isNetworkError
            ? 'Unable to reach the server. Check your connection and try again.'
            : 'An unexpected error occurred while loading this page.'}
        </p>
      )}

      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="brand" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild appearance="outline" variant="neutral">
          <Link href="/">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
