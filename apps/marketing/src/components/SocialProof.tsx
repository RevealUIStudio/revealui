export function SocialProof() {
  const features = [
    {
      title: '20-Collection CMS Engine',
      description:
        'Schema-first collections with rich text (Lexical), media, relationships, and lifecycle hooks. Define once, works everywhere.',
    },
    {
      title: '50+ Native UI Components',
      description:
        'Tailwind v4, zero external UI dependencies. Buttons, forms, tables, modals — all styled to your brand with CVA variants.',
    },
    {
      title: 'Real-Time Sync',
      description:
        'ElectricSQL keeps editors, clients, and agents in sync instantly — no polling, no manual refresh, no conflicts.',
    },
    {
      title: 'TypeScript End-to-End',
      description:
        'Zod schemas flow from database to API to UI. No `any` types, no runtime surprises, complete IDE autocomplete.',
    },
    {
      title: 'Stripe Billing Built In',
      description:
        'Pro tier checkout, webhook handling, license JWTs, and billing portal — wired end-to-end and verified in production.',
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
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">What's Included</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Every layer of the stack, production-ready
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200"
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
