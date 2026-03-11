/**
 * Loading skeleton component for better UX during markdown file loading
 */

export function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-[var(--width-content)] px-8 py-10">
      {/* Title skeleton */}
      <div className="mb-6 h-8 w-[55%] animate-pulse rounded-md bg-border" />

      {/* Paragraph skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4">
          <div
            className="mb-2 h-3.5 w-full animate-pulse rounded bg-border"
            style={{ animationDelay: `${i * 100}ms` }}
          />
          <div
            className="h-3.5 w-4/5 animate-pulse rounded bg-border"
            style={{ animationDelay: `${i * 100 + 50}ms` }}
          />
        </div>
      ))}

      {/* Code block skeleton */}
      <div className="mt-6 h-28 w-full animate-pulse rounded-lg border border-border bg-code-bg" />
    </div>
  );
}

/**
 * Compact loading indicator for inline use
 */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-border border-t-accent" />
    </div>
  );
}
