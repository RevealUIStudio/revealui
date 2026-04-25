const faqs = [
  {
    q: 'How is this different from Supabase, Convex, or T3?',
    a: 'Those give you a database, an auth primitive, or a starter template. RevealUI is a complete runtime: CMS, billing, admin UI, and agent layer all wired together. Drop in a single package, or scaffold the whole stack with one command.',
  },
  {
    q: 'Can I self-host?',
    a: 'Yes. Every open-source package is MIT-licensed. The Pro packages are Fair Source (FSL-1.1-MIT) and convert to MIT after two years. Self-host the entire stack on your own infra at any tier — no vendor-specific edge runtimes, no proprietary database.',
  },
  {
    q: 'What does "agent-native" actually mean in code?',
    a: 'Every collection, mutation, and admin action is exposed as an MCP tool. Your agent reads users, creates invoices, edits CMS content, and refunds subscriptions through the same APIs your app uses. No glue layer, no separate "AI endpoints" to maintain.',
  },
  {
    q: "What's the lock-in story?",
    a: 'Open standards, end-to-end. OAuth, JWT, Stripe webhooks, MCP, OpenAPI. Postgres for data. Deploy anywhere Next.js and Hono run. Your data, your code, your infra — RevealUI is the runtime, not the prison.',
  },
  {
    q: 'Production-ready?',
    a: 'Built behind a full CI gate: Biome lint, Vitest unit and integration, Playwright E2E, CodeQL, Gitleaks, dependency auditing. The full feature set is covered by the test suite, and every PR runs the gate before it can land. Used in production by RevealUI Studio.',
  },
  {
    q: "What's the rest of the suite?",
    a: 'RevealUI is the runtime. RevVault handles secrets. RevKit is the portable dev environment. RevDev is the AI engineering harness. Forge is a portable demo lab. You can use RevealUI without any of the others — they ship and version independently.',
  },
];

export function FaqV2() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Common questions.
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <dl className="divide-y divide-gray-200">
            {faqs.map((item) => (
              <details key={item.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                  <dt className="text-lg font-semibold leading-7 text-gray-950">{item.q}</dt>
                  <span className="ml-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition group-open:rotate-45 group-open:bg-emerald-50 group-open:text-emerald-700">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <title>Toggle</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </span>
                </summary>
                <dd className="mt-4 pr-9 text-base leading-7 text-gray-600">{item.a}</dd>
              </details>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
