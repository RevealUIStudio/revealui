export default function FrontendLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
