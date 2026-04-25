import { Button, ButtonCVA } from '@revealui/presentation';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'self-host, forever',
    description: 'All open-source packages. MIT-licensed. No telemetry.',
    features: [
      'Full primitive stack',
      'Admin dashboard + API',
      'Self-host on any infra',
      'Community support',
    ],
    cta: 'Start free',
    href: 'https://admin.revealui.com/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'From $TBD',
    cadence: 'per workspace / month',
    description: 'Managed hosting, AI primitives, and priority support.',
    features: [
      'Everything in Free',
      'Managed hosting + auto-scaling',
      'Pro AI features (agents, RAG, MCP)',
      'Priority support, SLA',
    ],
    cta: 'See Pro pricing',
    href: '/pricing',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'volume + governance',
    description: 'SSO, audit logs, on-prem deployment, and a named contact.',
    features: [
      'Everything in Pro',
      'SSO + SCIM provisioning',
      'Audit logs + compliance reports',
      'On-prem and air-gapped deploy',
    ],
    cta: 'Talk to us',
    href: '/contact',
    highlight: false,
  },
];

export function PricingTeaserV2() {
  return (
    <section className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Start free. Pay when you scale.
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Self-host the open-source stack at no cost. Move to Pro for managed hosting and AI
            primitives.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl p-8 ring-1 transition ${
                t.highlight
                  ? 'bg-gray-950 text-white ring-gray-950 shadow-xl'
                  : 'bg-white text-gray-950 ring-gray-950/10 hover:ring-gray-950/20'
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">{t.price}</span>
                <span className={`text-sm ${t.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                  / {t.cadence}
                </span>
              </div>
              <p
                className={`mt-4 text-sm leading-6 ${
                  t.highlight ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {t.description}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-sm ${
                      t.highlight ? 'text-gray-200' : 'text-gray-700'
                    }`}
                  >
                    <svg
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        t.highlight ? 'text-emerald-400' : 'text-emerald-500'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <title>Included</title>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {t.highlight ? (
                  <ButtonCVA
                    asChild
                    size="default"
                    className="w-full bg-white text-gray-950 hover:bg-gray-100"
                  >
                    <a href={t.href}>{t.cta}</a>
                  </ButtonCVA>
                ) : (
                  <ButtonCVA asChild size="default" variant="outline" className="w-full">
                    <a href={t.href}>{t.cta}</a>
                  </ButtonCVA>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button plain href="/pricing" className="text-sm font-medium">
            See full pricing &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
