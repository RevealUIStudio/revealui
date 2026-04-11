'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-gray-600">We encountered an unexpected error. Please try again.</p>
      {error.digest && <p className="mt-1 text-xs text-gray-400">Error ID: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
