export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Header skeleton */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto h-12 w-72 rounded-lg bg-gray-200" />
          <div className="mx-auto mt-2 h-12 w-48 rounded-lg bg-gray-200" />
          <div className="mx-auto mt-6 h-5 w-96 max-w-full rounded bg-gray-200" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <div className="h-8 w-40 rounded-full bg-blue-100" />
            <div className="h-8 w-40 rounded-full bg-purple-100" />
            <div className="h-8 w-44 rounded-full bg-emerald-100" />
          </div>
        </div>
      </section>

      {/* Subscription tiers skeleton */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <div className="mx-auto h-4 w-20 rounded bg-gray-200" />
            <div className="mx-auto mt-3 h-8 w-56 rounded bg-gray-200" />
            <div className="mx-auto mt-4 h-5 w-80 rounded bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable ID
                key={i}
                className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
              >
                <div className="mb-8">
                  <div className="h-6 w-24 rounded bg-gray-200" />
                  <div className="mt-3 h-4 w-full rounded bg-gray-100" />
                  <div className="mt-6 h-10 w-28 rounded bg-gray-200" />
                </div>
                <div className="mb-8 space-y-3">
                  <div className="h-4 w-full rounded bg-gray-100" />
                  <div className="h-4 w-5/6 rounded bg-gray-100" />
                  <div className="h-4 w-4/6 rounded bg-gray-100" />
                  <div className="h-4 w-5/6 rounded bg-gray-100" />
                  <div className="h-4 w-3/6 rounded bg-gray-100" />
                </div>
                <div className="h-11 w-full rounded-md bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
