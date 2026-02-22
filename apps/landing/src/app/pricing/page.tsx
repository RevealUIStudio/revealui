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
    description: 'For agencies building professional client sites.',
    features: [
      'Unlimited CMS collections',
      'Up to 5 sites',
      'Up to 25 users/editors',
      'Session-based auth',
      '1 AI agent with LLM provider',
      'AI working memory',
      'Built-in Stripe payments',
      'Full real-time sync',
      'Email support (48h response)',
      'Full source code access',
    ],
    cta: 'Start Free Trial',
    ctaHref: `${process.env.NEXT_PUBLIC_CMS_URL || ''}/signup?plan=pro`,
    featured: true,
  },
  {
    name: 'Enterprise',
    id: 'enterprise',
    price: '$299',
    period: '/month',
    description: 'For large agencies with advanced requirements.',
    features: [
      'Unlimited CMS collections',
      'Unlimited sites',
      'Unlimited users/editors',
      'Session + SSO/SAML auth',
      'All AI providers',
      'Full AI memory (working + episodic + vector)',
      'Stripe payments + invoicing',
      'Full sync + conflict resolution',
      'Multi-tenant architecture',
      'White-label branding',
      'Slack support (4h SLA)',
      'Full source code access',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:founder@revealui.com?subject=Enterprise%20Inquiry',
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
      "The Pro tier includes a 14-day free trial. After the trial ends, you'll be charged $49/month. You can cancel anytime during the trial without being charged.",
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated amount immediately. When downgrading, the change takes effect at the end of your current billing period.",
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'Pro tier includes one LLM provider (OpenAI, Anthropic, or Google). Enterprise tier includes all providers plus custom model endpoints and fine-tuned models.',
  },
  {
    question: 'What does "full source code access" mean?',
    answer:
      'You get the complete RevealUI source code, including all apps and packages. You can modify, extend, and deploy it however you need. Pro and Enterprise tiers include priority updates and features.',
  },
  {
    question: 'Do you offer custom pricing for large teams?',
    answer:
      'Yes! If you need more than what the Enterprise tier offers, contact us at founder@revealui.com to discuss custom pricing and SLAs.',
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
            Start with our free open-source tier, upgrade to Pro for professional features, or go
            Enterprise for unlimited scale.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative rounded-2xl bg-white p-8 shadow-lg ${
                  tier.featured
                    ? 'ring-2 ring-blue-600 scale-105 lg:scale-110 z-10'
                    : 'ring-1 ring-gray-200'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-5 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white text-center shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold tracking-tight text-gray-900">{tier.name}</h3>
                  <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span className="text-5xl font-bold tracking-tight text-gray-900">
                      {tier.price}
                    </span>
                    {tier.period && <span className="text-sm text-gray-600">{tier.period}</span>}
                  </p>
                </div>
                <ul className="mb-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <svg
                        className="h-6 w-6 flex-none text-blue-600"
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
                {tier.id === 'free' ? (
                  <a
                    href={tier.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block w-full rounded-md px-8 py-4 text-center text-base font-semibold transition-colors ${
                      tier.featured
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {tier.cta}
                  </a>
                ) : tier.id === 'enterprise' ? (
                  <a
                    href={tier.ctaHref}
                    className={`block w-full rounded-md px-8 py-4 text-center text-base font-semibold transition-colors ${
                      tier.featured
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <a
                    href={tier.ctaHref}
                    className={`block w-full rounded-md px-8 py-4 text-center text-base font-semibold transition-colors ${
                      tier.featured
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {tier.cta}
                  </a>
                )}
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
