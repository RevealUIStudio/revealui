import { Badge } from '@revealui/presentation';

export function SocialProof() {
  const stats = [
    { value: '5', label: 'problems solved' },
    { value: '21', label: 'npm packages' },
    { value: '12', label: 'MCP servers' },
    { value: 'MIT', label: 'licensed' },
  ];

  const techStack = [
    'TypeScript',
    'React 19',
    'Next.js 16',
    'Hono',
    'Drizzle ORM',
    'Stripe',
    'Tailwind v4',
    'ElectricSQL',
  ];

  const features = [
    {
      title: 'Content Engine',
      description:
        'Schema-first collections with Lexical-powered rich text fields, media, relationships, and lifecycle hooks. Define once, query everywhere via REST API.',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Native UI Components',
      description:
        'Tailwind v4, zero external UI dependencies. Buttons, forms, tables, modals, sidebars  -  all styled to your brand with CVA variants.',
      icon: 'M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Real-Time Sync',
      description:
        'ElectricSQL-powered sync foundation for editors, clients, and agents  -  no polling, no manual refresh. Collaborative editing coming soon.',
      icon: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
      iconColor: 'text-cyan-400',
    },
    {
      title: 'AI Agents (Pro)',
      description:
        'A2A protocol agent system with CRDT memory, tool execution, and open-model inference  -  local or cloud-hosted via the RevealUI harness. No proprietary API keys required.',
      icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z',
      iconColor: 'text-violet-400',
    },
    {
      title: 'Stripe Billing Built In',
      description:
        'Checkout, subscriptions, webhook handling, license keys, and billing portal  -  pre-wired end-to-end.',
      icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Multi-Tenant by Design',
      description:
        'One deployment, many clients. Data isolation and RBAC access control from day one.',
      icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21',
      iconColor: 'text-orange-400',
    },
  ];

  return (
    <section className="py-24 bg-gray-950 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Stats strip */}
        <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-emerald-500/20 via-gray-800 to-emerald-500/20 p-px shadow-lg shadow-emerald-500/5">
          <dl className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden bg-gray-800 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col bg-gray-900 px-8 py-6 text-center">
                <dt className="text-sm leading-6 text-gray-400">{stat.label}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-white">
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
              <Badge
                key={tech}
                color="zinc"
                className="rounded-full bg-gray-800 px-4 py-1.5 text-gray-300 ring-1 ring-gray-700"
              >
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="mx-auto max-w-2xl text-center mt-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            What&apos;s Included
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every layer of the stack, already built
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-4 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-2xl bg-gray-900 p-8 ring-1 ring-gray-800 hover:ring-gray-700 transition-all"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 group-hover:bg-gray-700 transition-colors">
                <svg
                  className={`h-5 w-5 ${feature.iconColor}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <title>{feature.title}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
