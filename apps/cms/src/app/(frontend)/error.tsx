'use client'

export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <h2 className="text-xl font-semibold text-neutral-900">We hit a snag</h2>
      <p className="max-w-lg text-center text-neutral-600">
        Something unexpected happened. Please try again or come back later.
      </p>
      {error.digest && <p className="text-xs text-neutral-400">Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  )
}
