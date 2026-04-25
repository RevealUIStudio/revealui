export function Problem() {
  const without = [
    'Auth, sessions, RBAC',
    'Stripe billing + webhooks',
    'A CMS for your team',
    'An admin dashboard',
    'Background jobs and queues',
    'Agent glue for every endpoint',
  ];

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            The problem
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Every SaaS rebuilds the same plumbing.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Then AI apps bolt agents on top with brittle glue. RevealUI ships the stack already
            wired &mdash; and exposes every primitive as a tool your agents can call.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 lg:max-w-5xl lg:grid-cols-2">
          {/* Without RevealUI */}
          <div className="rounded-2xl bg-gray-50 p-8 ring-1 ring-gray-950/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Without RevealUI
            </p>
            <h3 className="mt-2 text-xl font-semibold text-gray-950">Six months of plumbing</h3>
            <ul className="mt-6 space-y-3">
              {without.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <title>Build it yourself</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* With RevealUI */}
          <div className="rounded-2xl bg-gray-950 p-8 ring-1 ring-gray-950/5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              With RevealUI
            </p>
            <h3 className="mt-2 text-xl font-semibold">One command</h3>

            <div className="mt-6 rounded-xl bg-black/40 px-5 py-4 font-mono text-sm ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <span className="select-none text-gray-500">$</span>
                <span className="text-emerald-400">npx</span>
                <span className="text-white">create-revealui</span>
                <span className="text-blue-300">my-app</span>
              </div>
              <div className="mt-3 space-y-1 text-xs leading-5 text-gray-400">
                <div>
                  <span className="text-emerald-400">&#x2713;</span> Auth + sessions + RBAC
                </div>
                <div>
                  <span className="text-emerald-400">&#x2713;</span> Stripe billing + webhooks
                </div>
                <div>
                  <span className="text-emerald-400">&#x2713;</span> Content collections + admin UI
                </div>
                <div>
                  <span className="text-emerald-400">&#x2713;</span> REST API + MCP tools
                </div>
                <div>
                  <span className="text-emerald-400">&#x2713;</span> Agent-ready from first deploy
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-gray-300">
              Skip the integration tax. Ship product instead.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
