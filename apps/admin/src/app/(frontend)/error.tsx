'use client';

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
      {/* Icon */}
      <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <svg
          className="size-7 text-red-500 dark:text-red-400"
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
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
