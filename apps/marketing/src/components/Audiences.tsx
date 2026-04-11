import { Button } from '@revealui/presentation';

export function Audiences() {
  return (
    <section className="py-24 bg-white sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Who it&apos;s for
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Built for builders and their agents
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-500">
            Whether you&apos;re starting from scratch or retrofitting a product you already ship,
            RevealUI gives you the business layer, and makes it agent-accessible from day one.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2">
          {/* Card 1: Existing products */}
          <div className="group flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-950/5 hover:ring-gray-950/10 transition-all">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-950 shadow-sm">
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
            <h3 className="text-xl font-semibold leading-7 text-gray-950">
              Retrofit your existing product
            </h3>
            <p className="mt-4 text-base leading-7 text-gray-500">
              Already shipping but missing the business layer? RevealUI&apos;s packages are modular.
              Drop in what you need without rebuilding what you have.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-gray-500">
              {[
                'Add billing and subscriptions without touching your core app',
                'Layer proper auth, RBAC, and sessions on top of what you ship',
                'Plug in a content engine so your team publishes without you',
                'Make every feature agent-accessible through MCP automatically',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
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
              <Button plain href="https://docs.revealui.com" className="text-sm font-medium">
                See the full package list &rarr;
              </Button>
            </p>
          </div>

          {/* Card 2: Start fresh */}
          <div className="group flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-950/5 hover:ring-gray-950/10 transition-all">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 shadow-sm">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <title>Rocket</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold leading-7 text-gray-950">
              Start fresh with everything
            </h3>

            <div className="mt-4">
              <p className="text-base leading-7 text-gray-500">
                One CLI command gives you a complete business stack: auth, content, billing, admin
                dashboard, REST API, and MCP servers. You get a running business. Your agents get a
                runtime they can operate on immediately.
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-gray-950 px-5 py-4 font-mono text-sm">
              <div className="flex items-center gap-2">
                <span className="select-none text-gray-400">$</span>
                <span className="text-emerald-400">npx</span>
                <span className="text-white">create-revealui</span>
                <span className="text-blue-300">my-app</span>
              </div>
              <div className="mt-2 text-gray-400 text-xs leading-5">
                <div>&#x2713; Auth + sessions + RBAC</div>
                <div>&#x2713; Stripe billing + webhooks</div>
                <div>&#x2713; Content collections + REST API</div>
                <div>&#x2713; Admin dashboard + MCP servers</div>
                <div>&#x2713; Agent-ready from first deploy</div>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-6">
              <Button
                plain
                href="https://docs.revealui.com/docs/QUICK_START"
                className="text-sm font-medium text-emerald-700 data-hover:text-emerald-600"
              >
                Quick start guide &rarr;
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
