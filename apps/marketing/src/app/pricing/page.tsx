import { Footer } from '@/components/Footer'

const tiers = [
  {
    name: 'Free (OSS)',
    id: 'free',
    price: '$0',
    description: 'Perfect for trying out RevealUI and small projects.',
    features: [
      'Unlimited CMS collections',
      '1 site',
      'Up to 3 users/editors',
      'Session-based auth',
      'Basic real-time sync',
      'Community support',
      'Full source code access',
    ],
    cta: 'Get Started',
    ctaHref: 'https://github.com/RevealUIStudio/revealui',
    featured: false,
  },
  {
    name: 'Pro',
    id: 'pro',
    price: '$49',
    period: '/month',
    description: 'For software companies building production products.',
    features: [
      'Unlimited CMS collections',
      'Up to 5 sites',
      'Up to 25 users/editors',
      'Session-based auth',
      'AI agents (BYOK — bring your own LLM key)',
      'Built-in Stripe payments',
      'Full real-time sync',
      'Monitoring dashboard',
      'Custom domain mapping',
      'Email support (48h response)',
      'Full source code access',
    ],
    cta: 'Start Free Trial',
    ctaHref: `${process.env.NEXT_PUBLIC_CMS_URL || 'https://cms.revealui.com'}/signup?plan=pro`,
    featured: true,
  },
  {
    name: 'Max',
    id: 'max',
    price: '$149',
    period: '/month',
    description: 'For teams that need AI memory, multi-provider, and compliance tooling.',
    features: [
      'Everything in Pro',
      'Up to 15 sites',
      'Up to 100 users/editors',
      'Full AI memory (working + episodic + vector)',
      'Multi-provider AI (up to 2 providers)',
      'BYOK server-side key storage',
      'Audit logging',
      'Email support (24h response)',
      'Full source code access',
    ],
    cta: 'Start Free Trial',
    ctaHref: `${process.env.NEXT_PUBLIC_CMS_URL || 'https://cms.revealui.com'}/signup?plan=max`,
    featured: false,
  },
  {
    name: 'Forge',
    id: 'enterprise',
    price: '$299',
    period: '/month',
    description: 'For teams with advanced scale and compliance requirements.',
    features: [
      'Everything in Max',
      'Unlimited sites',
      'Unlimited users/editors',
      'Session-based auth + OAuth + SSO/SAML',
      'All AI providers (unlimited)',
      'Multi-tenant architecture',
      'White-label branding',
      'Slack support (4h SLA)',
      'Annual pricing available',
      'Full source code access',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:founder@revealui.com?subject=Forge%20Inquiry',
    featured: false,
  },
]

const faqs = [
  {
    question: 'Can I use the Free tier for commercial projects?',
    answer:
      'Yes! The Free tier is fully open-source and can be used for commercial projects. You get full source code access and can deploy it anywhere you like.',
  },
  {
    question: 'What happens after the free trial ends?',
    answer:
      "Pro and Max tiers include a 7-day free trial. After the trial ends, you'll be charged the monthly rate. You can cancel anytime during the trial without being charged.",
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      "Yes, you can upgrade your plan at any time — you'll be charged the prorated amount immediately. To downgrade, visit your billing portal or contact founder@revealui.com.",
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'RevealUI uses BYOK (bring your own key) — you connect your own API key from any supported provider: Anthropic, OpenAI, Groq, Ollama (local), or Vultr. You pay the provider directly; RevealUI adds no markup. Max allows 2 providers simultaneously; Forge allows all.',
  },
  {
    question: 'What does "full source code access" mean?',
    answer:
      'You get the complete RevealUI source code, including all apps and packages. You can modify, extend, and deploy it however you need. All paid tiers include priority updates and commercial package access.',
  },
  {
    question: 'Do you offer custom pricing for large teams?',
    answer:
      'Yes! If you need more than what the Forge tier offers, contact us at founder@revealui.com to discuss custom pricing and SLAs.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Choose Your
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Perfect Plan
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Start free, scale as you grow. All paid tiers include a 7-day free trial and full source
            code access.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative rounded-2xl bg-white p-8 shadow-lg ${
                  tier.featured ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm font-semibold text-white text-center shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold tracking-tight text-gray-900">{tier.name}</h3>
                  <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      {tier.price}
                    </span>
                    {tier.period && <span className="text-sm text-gray-600">{tier.period}</span>}
                  </p>
                </div>
                <ul className="mb-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <svg
                        className="h-5 w-5 shrink-0 text-blue-600 mt-0.5"
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
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.ctaHref}
                  target={tier.id === 'free' ? '_blank' : undefined}
                  rel={tier.id === 'free' ? 'noopener noreferrer' : undefined}
                  className={`block w-full rounded-md px-6 py-3 text-center text-sm font-semibold transition-colors ${
                    tier.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center mb-12">
              Frequently Asked Questions
            </h2>
            <dl className="space-y-8">
              {faqs.map((faq) => (
                <div key={faq.question} className="bg-white rounded-lg p-6 shadow-sm">
                  <dt className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</dt>
                  <dd className="text-base text-gray-600">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
