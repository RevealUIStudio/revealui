'use client';

export default function BackendError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-neutral-600">
        An error occurred while loading this page.
      </p>
      {error.digest && <p className="text-xs text-neutral-400">Error ID: {error.digest}</p>}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  );
}
