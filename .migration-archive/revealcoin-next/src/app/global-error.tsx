'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
          <p className="mt-2 text-gray-600">A critical error occurred. Please refresh the page.</p>
          {error.digest && <p className="mt-1 text-xs text-gray-400">Error ID: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
