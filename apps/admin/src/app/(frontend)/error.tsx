'use client';

import { Button, IconAlertTriangle } from '@revealui/presentation/server';
import Link from 'next/link';

export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 py-16">
      <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <IconAlertTriangle className="size-7 text-red-500 dark:text-red-400" aria-hidden="true" />
      </div>

      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">We hit a snag</h2>

      <p className="max-w-lg text-center text-neutral-600 dark:text-zinc-400">
        Something unexpected happened. Please try again or come back later.
      </p>

      {error.digest && (
        <p className="font-mono text-xs text-neutral-400 dark:text-zinc-600">
          Reference: {error.digest}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="neutral"
          onClick={() => reset()}
          className="bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Try again
        </Button>
        <Button asChild appearance="outline" variant="neutral">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
