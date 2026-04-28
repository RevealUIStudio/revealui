import { Button } from '@revealui/presentation';

const stack = [
  { label: 'Next.js', kind: 'Frontend + edge' },
  { label: 'React 19', kind: 'UI runtime' },
  { label: 'PostgreSQL', kind: 'Database' },
  { label: 'Drizzle', kind: 'ORM' },
  { label: 'Stripe', kind: 'Payments' },
  { label: 'Hono', kind: 'API' },
  { label: 'MCP', kind: 'Agent protocol' },
  { label: 'Tailwind', kind: 'Design system' },
];

const ciSignals = [
  'Biome lint + format',
  'Vitest unit + integration',
  'Playwright E2E',
  'CodeQL + Gitleaks',
  'TypeScript strict, repo-wide',
  'Affected-only PR gate',
];

export function Proof() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            The stack so far
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Built in the open. Verifiable in the repo.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Every package, every PR, every test. Inspect the code before you commit a single line of
            your own.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Repo signals */}
          <div className="rounded-2xl bg-gray-50 p-8 ring-1 ring-gray-950/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              On GitHub
            </p>
            <h3 className="mt-2 text-xl font-semibold text-gray-950">Live signals</h3>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/RevealUIStudio/revealui"
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:ring-gray-400 transition"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <title>GitHub</title>
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38s1.95.13 2.86.38c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                </svg>
                {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, next/image optimization adds no value */}
                <img
                  alt="GitHub stars"
                  src="https://img.shields.io/github/stars/RevealUIStudio/revealui?style=flat&label=Stars&color=10b981"
                  className="h-5"
                />
              </a>
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, next/image optimization adds no value */}
              <img
                alt="Contributors"
                src="https://img.shields.io/github/contributors/RevealUIStudio/revealui?style=flat&label=Contributors&color=10b981"
                className="h-7 rounded-md ring-1 ring-gray-300"
              />
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, next/image optimization adds no value */}
              <img
                alt="Last commit"
                src="https://img.shields.io/github/last-commit/RevealUIStudio/revealui?style=flat&label=Last%20commit&color=10b981"
                className="h-7 rounded-md ring-1 ring-gray-300"
              />
              {/* biome-ignore lint/performance/noImgElement: dynamic shields.io SVG badge, next/image optimization adds no value */}
              <img
                alt="License"
                src="https://img.shields.io/github/license/RevealUIStudio/revealui?style=flat&color=10b981"
                className="h-7 rounded-md ring-1 ring-gray-300"
              />
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Quality gates that block every PR
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ciSignals.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-emerald-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <title>Gate</title>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stack standards */}
          <div className="rounded-2xl bg-gray-950 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              No proprietary lock-in
            </p>
            <h3 className="mt-2 text-xl font-semibold">Standards your team already knows</h3>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              No proprietary runtime, no vendor-specific edge functions. Deploy where Next.js and
              Hono run. Take your data with you.
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-3">
              {stack.map((s) => (
                <li
                  key={s.label}
                  className="rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10"
                >
                  <div className="text-sm font-semibold text-white">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.kind}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button
            plain
            href="https://github.com/RevealUIStudio/revealui/blob/main/CHANGELOG.md"
            className="text-sm font-medium"
          >
            See what shipped this month &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
