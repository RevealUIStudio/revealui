export function SocialProof() {
  const features = [
    {
      title: 'Open Source Core',
      description:
        'MIT-licensed CMS engine, UI components, and routing layer. Self-host or deploy to any cloud.',
    },
    {
      title: 'AI-Powered Workflows',
      description:
        'Natural language to business outcomes. Describe what you want done — the agent handles the rest.',
    },
    {
      title: 'Multi-Tenant by Design',
      description:
        'Manage multiple client sites from one dashboard with full data isolation and custom branding.',
    },
    {
      title: 'TypeScript First',
      description:
        'End-to-end type safety from database schema to UI components. No runtime surprises.',
    },
    {
      title: 'Real-Time Collaboration',
      description:
        'ElectricSQL-powered sync keeps editors, agents, and clients in sync without conflicts.',
    },
    {
      title: 'Source Code Access',
      description:
        'Pro and Enterprise tiers include full source. Customize anything, deploy anywhere.',
    },
  ]

  return (
    <section className="py-24 bg-gray-50 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Built for Builders</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to ship CMS-powered products
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200"
            >
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-3 text-base leading-7 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
