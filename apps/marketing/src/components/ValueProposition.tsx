export function ValueProposition() {
  const features = [
    {
      title: 'Own Your Stack',
      description:
        'MIT-licensed business infrastructure: users, content, products, payments, and AI agents — all in one monorepo. Deploy anywhere, white-label for clients, customize every line.',
      icon: (
        <svg
          className="h-8 w-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <title>Source code</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
          />
        </svg>
      ),
    },
    {
      title: 'AI Agents Built In',
      description:
        'Not a plugin — a first-class A2A protocol agent system. Describe a task in plain language, ship it as a structured background workflow. BYOK for full LLM provider control.',
      icon: (
        <svg
          className="h-8 w-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <title>AI agents</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z"
          />
        </svg>
      ),
    },
    {
      title: 'Production Stack Included',
      description:
        'Session auth, RBAC, brute-force protection, Stripe billing, ElectricSQL real-time sync, and multi-tenant isolation — wired end-to-end so you ship features, not infrastructure.',
      icon: (
        <svg
          className="h-8 w-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <title>Production stack</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3"
          />
        </svg>
      ),
    },
  ]

  return (
    <section className="py-24 bg-white sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Why RevealUI</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Stop stitching tools together
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Every software business needs the same foundation. RevealUI ships it pre-wired so you
            start on day one with a real running business — not a blank slate.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="flex flex-col items-start">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                  {feature.icon}
                </div>
                <dt className="text-lg font-semibold leading-7 text-gray-900">{feature.title}</dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
