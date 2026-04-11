import { Button } from '@revealui/presentation';

export function ValueProposition() {
  const features = [
    {
      title: 'Auth + Billing, Done',
      description:
        'Session auth, Stripe subscriptions, usage metering, and webhooks  -  already connected. Add signup, billing, and access control to your product without integrating four different services.',
      icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
      accent: 'bg-gray-950',
      href: 'https://docs.revealui.com/docs/QUICK_START',
    },
    {
      title: 'Content + Admin, Done',
      description:
        'Schema-first collections with Lexical rich text fields, media management, and a full admin dashboard  -  works out of the box. Define your data, get a REST API and admin UI for free.',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
      accent: 'bg-emerald-600',
      href: 'https://docs.revealui.com/docs/REFERENCE',
    },
    {
      title: 'AI + Agents, Done',
      description:
        'MCP servers, agent coordination, and open-model inference  -  built into the foundation, not bolted on. Run AI locally or in the cloud, no proprietary API keys required for development.',
      icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z',
      accent: 'bg-violet-600',
      href: 'https://docs.revealui.com/docs/AI',
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
            start on day one with a real running business - not a blank slate. Built on the JOSHUA
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
