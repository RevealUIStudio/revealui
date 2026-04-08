'use client';

import Link from 'next/link';

export default function BackendError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetworkError =
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('ECONNREFUSED');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8">
      {/* Icon */}
      <div className="flex size-14 items-center justify-center rounded-full bg-red-900/20">
        <svg
          className="size-7 text-red-400"
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

      <h2 className="text-lg font-semibold text-white">Something went wrong</h2>

      <p className="max-w-md text-center text-sm text-zinc-400">
        {isNetworkError
          ? 'Unable to reach the server. Check your connection and try again.'
          : 'An unexpected error occurred while loading this page.'}
      </p>

      {error.digest && <p className="font-mono text-xs text-zinc-600">Error ID: {error.digest}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
