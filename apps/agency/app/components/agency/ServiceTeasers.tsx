import { Link } from '@revealui/router';

interface ServiceTier {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
  startingAt: string;
}

const tiers: ServiceTier[] = [
  {
    slug: 'forge-stamp',
    title: 'Forge Stamp',
    tagline: 'Customer-specific RevealUI deployment',
    description:
      'A stamped instance of the Forge platform configured for your business — branding, integrations, and rollout in weeks, not quarters.',
    bullets: [
      'Branded white-label deployment',
      'Multi-tenant + domain-locked',
      'Optional managed hosting',
      'Onboarding included',
    ],
    startingAt: 'Starting at $X',
  },
  {
    slug: 'custom-build',
    title: 'Custom Build',
    tagline: 'Bespoke platform engagement',
    description:
      'Full custom platform engineering on the RevealUI runtime — we design, build, and ship the system your AI agents actually need.',
    bullets: [
      'Discovery + scoping',
      'TypeScript + Postgres + RevealUI primitives',
      'Stripe billing wired',
      '4-12 week sprints',
    ],
    startingAt: 'From $Y',
  },
  {
    slug: 'ai-integration',
    title: 'AI Integration',
    tagline: 'Agent-driven product consulting',
    description:
      'Integrate Claude, GPT, or local models into your existing system using RevealUI Suite primitives. MCP, tool use, sampling, agent-safe tenancy — done right.',
    bullets: [
      'MCP server stand-up',
      'Tool design + safety review',
      'Agent-tenant scope enforcement',
      'Production-ready handoff',
    ],
    startingAt: '2-week sprint, fixed bid',
  },
];

export function ServiceTeasers() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Productized engagements.
          </h2>
          <p className="mt-4 text-base text-gray-600">
            Three lanes for working with RevealUI Studio. Pricing posted; scope adjustable;
            discovery call required.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.slug}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                {tier.tagline}
              </p>
              <h3 className="mt-2 text-xl font-bold text-gray-950">{tier.title}</h3>
              <p className="mt-3 text-sm text-gray-600">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-gray-700">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <title>Check</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 border-t border-gray-100 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {tier.startingAt}
                </p>
                <Link
                  to="/contact"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-50 transition-colors"
                >
                  Inquire
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
