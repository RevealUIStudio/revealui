interface Row {
  capability: string;
  sprawl: string;
  agentOnly: string;
  revealui: string;
}

const rows: Row[] = [
  {
    capability: 'Auth + RBAC + sessions',
    sprawl: 'Clerk Pro ($25/seat)',
    agentOnly: 'Bring your own',
    revealui: 'Built in',
  },
  {
    capability: 'CMS + admin UI',
    sprawl: 'Payload + your team',
    agentOnly: 'Bring your own',
    revealui: 'Built in',
  },
  {
    capability: 'Stripe billing + webhooks',
    sprawl: 'Stripe + your code',
    agentOnly: 'Bring your own',
    revealui: 'Built in (with reconciliation)',
  },
  {
    capability: 'MCP tools for every API',
    sprawl: 'Per-collection plugin',
    agentOnly: 'Tool registry only',
    revealui: 'Auto-exposed, RBAC-governed',
  },
  {
    capability: 'Tamper-evident audit log',
    sprawl: 'Datadog + custom hashing',
    agentOnly: 'Logs only',
    revealui: 'Hash-chained, in DB',
  },
  {
    capability: 'Cost (5 devs, mid-startup)',
    sprawl: '~$1,200 / mo',
    agentOnly: '~$300 / mo + infra',
    revealui: '$49 / mo + infra',
  },
];

export function Problem() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            The problem
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Vendor sprawl, or framework-only. Pick neither.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Most AI teams glue together a half-dozen SaaS backends. Some pick a thin agent framework
            and rebuild auth, billing, and content from scratch. RevealUI is the third option:
            everything wired in, governed by one policy, owned by you.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl overflow-hidden rounded-2xl ring-1 ring-gray-950/10 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    Capability
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    Vendor sprawl
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-6 sm:py-4">
                    Agent framework only
                  </th>
                  <th
                    scope="col"
                    className="bg-emerald-50 px-4 py-3 text-emerald-800 sm:px-6 sm:py-4"
                  >
                    RevealUI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rows.map((r) => (
                  <tr key={r.capability} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-4 font-medium text-gray-950 sm:px-6">{r.capability}</td>
                    <td className="px-4 py-4 text-gray-600 sm:px-6">{r.sprawl}</td>
                    <td className="px-4 py-4 text-gray-600 sm:px-6">{r.agentOnly}</td>
                    <td className="bg-emerald-50/40 px-4 py-4 font-medium text-emerald-900 sm:px-6">
                      {r.revealui}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-gray-500">
          Sprawl prices reflect typical mid-startup invoices. RevealUI Pro is $49/mo + your own
          infrastructure. Vercel and Cloudflare are deploy targets, not competitors &mdash; RevealUI
          runs on both.
        </p>
      </div>
    </section>
  );
}
