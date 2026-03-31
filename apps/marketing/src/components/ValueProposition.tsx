import { Button } from '@revealui/presentation';

export function ValueProposition() {
  const features = [
    {
      title: 'Sovereign by Default',
      description:
        'MIT-licensed core. Deploy anywhere — Vercel, Railway, bare metal. Fork anything, white-label for clients, own every line. No vendor holds your business hostage.',
      icon: 'M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z',
      accent: 'bg-gray-950',
      href: 'https://docs.revealui.com/docs/QUICK_START',
    },
    {
      title: 'Adaptive Intelligence',
      description:
        'AI agents, MCP servers, and structured workflows — built into the foundation, not bolted on. BYOK, swap providers, evolve capabilities as your business grows.',
      icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z',
      accent: 'bg-violet-600',
      href: 'https://docs.revealui.com/docs/AI_AGENTS',
    },
    {
      title: 'Unified Truth',
      description:
        'One Zod schema defines the contract. Types, validation, and API flow from database to server to UI — zero drift, zero duplication, zero guesswork.',
      icon: 'M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3',
      accent: 'bg-emerald-600',
      href: 'https://docs.revealui.com/docs/REFERENCE',
    },
  ];

  return (
    <section id="value-proposition" className="py-24 bg-white sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Why RevealUI
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Stop stitching tools together
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-500">
            Every software business needs the same foundation. RevealUI ships it pre-wired so you
            start on day one with a real running business — not a blank slate. Built on the JOSHUA
            Stack: six engineering principles that govern every decision.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-xs border-t border-gray-200" />
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="group flex flex-col items-start">
                <dt className="text-lg font-semibold leading-7 text-gray-950">
                  <span
                    className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${feature.accent} shadow-sm group-hover:scale-105 transition-transform`}
                    aria-hidden="true"
                  >
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <title>{feature.title}</title>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </span>
                  {feature.title}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-500">{feature.description}</dd>
                <dd className="mt-4">
                  <Button plain href={feature.href} className="text-sm font-medium">
                    Learn more &rarr;
                  </Button>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
