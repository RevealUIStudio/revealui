export function SocialProof() {
  const stats = [
    { value: '18', label: 'packages' },
    { value: '320K+', label: 'lines of TypeScript' },
    { value: '1,400+', label: 'tests' },
    { value: '5', label: 'apps deployed' },
  ]

  const techStack = [
    'TypeScript',
    'React 19',
    'Next.js 16',
    'Hono',
    'Drizzle ORM',
    'Stripe',
    'Tailwind v4',
    'ElectricSQL',
  ]

  const features = [
    {
      title: 'Headless CMS Engine',
      description:
        'Schema-first collections with rich text (Lexical), media, relationships, and lifecycle hooks. Define once, works everywhere via REST API.',
    },
    {
      title: '50+ Native UI Components',
      description:
        'Tailwind v4, zero external UI dependencies. Buttons, forms, tables, modals, sidebars — all styled to your brand with CVA variants.',
    },
    {
      title: 'Real-Time Sync',
      description:
        'ElectricSQL keeps editors, clients, and agents in sync instantly — no polling, no manual refresh, no conflicts.',
    },
    {
      title: 'AI Agents (Pro)',
      description:
        'A2A protocol agent system with CRDT memory, tool execution, and BYOK LLM providers. Agents work in the background on structured tasks.',
    },
    {
      title: 'Stripe Billing Built In',
      description:
        'Checkout, subscriptions, webhook handling, license JWTs, and billing portal — wired end-to-end and verified in production.',
    },
    {
      title: 'Multi-Tenant by Design',
      description:
        'One deployment, many clients. Full data isolation, per-tenant branding, and RBAC access control from day one.',
    },
  ]

  return (
    <section className="py-24 bg-gray-50 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Stats strip */}
        <div className="mx-auto max-w-4xl">
          <dl className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden bg-gray-200 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col bg-white px-8 py-6 text-center">
                <dt className="text-sm leading-6 text-gray-600">{stat.label}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Tech stack */}
        <div className="mx-auto mt-10 max-w-4xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Built on
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="mx-auto max-w-2xl text-center mt-20">
          <h2 className="text-base font-semibold leading-7 text-blue-600">What's Included</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Every layer of the stack, production-ready
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-gray-300 transition-all"
            >
              <h3 className="text-base font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
