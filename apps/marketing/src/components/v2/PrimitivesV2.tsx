import { Button } from '@revealui/presentation';

const primitives = [
  {
    label: 'Users',
    body: 'Auth, organizations, RBAC, sessions.',
    color: 'emerald',
    iconPath:
      'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    label: 'Content',
    body: 'Headless CMS. Structured + freeform editing.',
    color: 'blue',
    iconPath:
      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    label: 'Products',
    body: 'Catalogs, entitlements, feature flags.',
    color: 'amber',
    iconPath:
      'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  },
  {
    label: 'Payments',
    body: 'Stripe billing, invoicing, dunning, webhooks.',
    color: 'cyan',
    iconPath:
      'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  {
    label: 'Intelligence',
    body: 'Agents, MCP tools, memory, RAG.',
    color: 'violet',
    iconPath:
      'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
  },
];

const accentBg: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function PrimitivesV2() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Five primitives, one runtime
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Everything a business needs. Nothing you don&apos;t.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Each primitive is a workspace package. Use them all, or pick what you need.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {primitives.map((p) => (
            <div
              key={p.label}
              className="flex flex-col items-start rounded-2xl bg-white p-6 ring-1 ring-gray-950/5 transition hover:ring-gray-950/10"
            >
              <div
                className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${accentBg[p.color]}`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.75}
                  stroke="currentColor"
                >
                  <title>{p.label}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-950">{p.label}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button plain href="https://docs.revealui.com" className="text-sm font-medium">
            See the primitive reference &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
