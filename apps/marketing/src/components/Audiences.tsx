export function Audiences() {
  return (
    <section className="py-24 bg-gray-50 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Who it's for</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Built for builders at every stage
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Whether you're starting from scratch or retrofitting a product you already ship,
            RevealUI gives you the business layer — without the years it takes to build it.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2">
          {/* Card 1: Existing products */}
          <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <title>Puzzle piece</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold leading-7 text-gray-900">
              Retrofit your existing product
            </h3>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Already shipping but missing the business layer? RevealUI's packages are modular —
              drop in what you need without rebuilding what you have.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-gray-600">
              {[
                'Add billing and subscriptions without touching your core app',
                'Layer proper auth, RBAC, and sessions on top of what you ship',
                'Give your team a CMS so they can publish without you',
                'Add AI agents your product can run as background workflows',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <title>Check</title>
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-gray-500">
              Pick the packages you need.{' '}
              <a href="https://docs.revealui.com" className="text-indigo-600 hover:text-indigo-500">
                See the full package list →
              </a>
            </p>
          </div>

          {/* Card 2: Non-technical users */}
          <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 shadow-sm">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <title>Sparkles</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold leading-7 text-gray-900">No code required</h3>

            <div className="mt-4">
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
                Available now
              </span>
              <p className="mt-3 text-base leading-7 text-gray-600">
                The RevealUI admin dashboard is live today. Non-technical team members can manage
                content, users, products, media, and billing — no code, no deployments, no waiting
                for a developer.
              </p>
              <a
                href="https://cms.revealui.com"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-600"
              >
                See the dashboard →
              </a>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                Coming soon
              </span>
              <ul className="mt-3 space-y-2.5 text-sm leading-6 text-gray-500">
                {[
                  'Visual collection builder — define data models without TypeScript',
                  'Template marketplace — launch a product from a pre-built starting point',
                  'No-code onboarding wizard — from zero to running in minutes',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <title>Clock</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
