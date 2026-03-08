import { CREDIT_BUNDLES, PERPETUAL_TIERS, SUBSCRIPTION_TIERS } from '@revealui/contracts/pricing'
import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Pricing — RevealUI',
  description:
    'Start free. Subscribe, pay per agent task, or buy a one-time license. Three ways to use RevealUI — pick what fits your business.',
  openGraph: {
    title: 'Pricing — RevealUI',
    description:
      'Start free. Subscribe, pay per agent task, or buy a one-time license. Three ways to use RevealUI.',
    type: 'website',
  },
}

// Resolve CTA hrefs for marketing context (absolute URLs for signup)
const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL || 'https://cms.revealui.com'
const tiers = SUBSCRIPTION_TIERS.map((tier) => ({
  ...tier,
  ctaHref: tier.ctaHref.startsWith('/') ? `${cmsUrl}${tier.ctaHref}` : tier.ctaHref,
}))

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const faqs = [
  {
    question: 'Can I use the Free tier for commercial projects?',
    answer:
      'Yes! The Free tier is fully open-source (MIT) and can be used for commercial projects. You get full source code access and can deploy it anywhere you like.',
  },
  {
    question: 'What happens after the free trial ends?',
    answer:
      "Pro and Max tiers include a 7-day free trial. After the trial ends, you'll be charged the monthly rate. You can cancel anytime during the trial without being charged.",
  },
  {
    question: 'What are agent credits?',
    answer:
      'Every paid subscription includes a monthly task allowance (Pro: 10K, Max: 50K, Forge: unlimited). The first 1,000 tasks/month are free on any tier. If you need more, buy credit bundles — they never expire and stack with your monthly allowance.',
  },
  {
    question: 'What are perpetual licenses?',
    answer:
      'A perpetual license is a one-time purchase that gives you a license key for the corresponding tier — forever, with no monthly subscription required. Support and updates are included for 1 year; after that, renew your support contract or keep using the version you have.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer:
      "Yes, you can upgrade your plan at any time — you'll be charged the prorated amount immediately. To downgrade, visit your billing portal or contact support@revealui.com.",
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'RevealUI uses BYOK (bring your own key) — you connect your own API key from any supported provider: Anthropic, Groq, Ollama (local), or Vultr. You pay the provider directly; RevealUI adds no markup. Max allows 2 providers simultaneously; Forge allows all.',
  },
  {
    question: 'What does "full source code access" mean?',
    answer:
      'You get the complete RevealUI source code, including all apps and packages. You can modify, extend, and deploy it however you need. All paid tiers include priority updates and commercial package access.',
  },
  {
    question: 'Do you offer custom pricing for large teams?',
    answer:
      'Yes! If you need more than what the Forge tier offers, contact us at support@revealui.com to discuss custom pricing and SLAs.',
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Three ways to use
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RevealUI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Subscribe monthly, pay per agent task, or buy a perpetual license. Start free — upgrade
            when you need to.
          </p>
          {/* Three-track badge row */}
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-medium">
            <a
              href="#track-a"
              className="rounded-full bg-blue-100 px-4 py-1.5 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              Track A — Subscriptions
            </a>
            <a
              href="#track-b"
              className="rounded-full bg-purple-100 px-4 py-1.5 text-purple-700 hover:bg-purple-200 transition-colors"
            >
              Track B — Agent Credits
            </a>
            <a
              href="#track-c"
              className="rounded-full bg-emerald-100 px-4 py-1.5 text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              Track C — Perpetual Licenses
            </a>
          </div>
        </div>
      </section>

      {/* Track A — Subscription tiers */}
      <section id="track-a" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-blue-600 uppercase">
              Track A
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Subscription Plans
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Monthly subscriptions with a task allowance included. 7-day free trial on Pro and Max.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative rounded-2xl bg-white p-8 shadow-lg ${
                  tier.highlighted ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200'
                }`}
              >
                {tier.highlighted && (
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
                    tier.highlighted
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

      {/* Track B — Agent Credits */}
      <section id="track-b" className="bg-purple-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-purple-600 uppercase">
              Track B
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Agent Credits
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Pay per agent task. Buy once, never expires. Stacks with your monthly allowance.
            </p>
            <p className="mt-2 text-sm font-medium text-purple-700 bg-purple-100 inline-block px-3 py-1 rounded-full">
              First 1,000 tasks/month free on every plan
            </p>
          </div>
          <div className="mx-auto max-w-4xl grid grid-cols-1 gap-6 sm:grid-cols-3">
            {CREDIT_BUNDLES.map((bundle) => (
              <div
                key={bundle.name}
                className={`rounded-2xl bg-white p-8 shadow-lg ${
                  bundle.highlighted ? 'ring-2 ring-purple-500' : 'ring-1 ring-gray-200'
                }`}
              >
                {bundle.highlighted && (
                  <div className="mb-3 text-center">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                      Best value
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{bundle.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{bundle.description}</p>
                <p className="mt-4 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold text-gray-900">{bundle.price}</span>
                  <span className="text-sm text-gray-500">{bundle.priceNote}</span>
                </p>
                <p className="mt-1 text-xl font-semibold text-purple-600">{bundle.tasks} tasks</p>
                <p className="mt-1 text-xs text-gray-400">{bundle.costPer}</p>
                <a
                  href="mailto:support@revealui.com?subject=Agent%20Credits%20Inquiry"
                  className={`mt-8 block w-full rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    bundle.highlighted
                      ? 'bg-purple-600 text-white hover:bg-purple-500'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Buy Credits
                </a>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Credits are available to Pro, Max, and Forge subscribers. Overage billing via Stripe —
            no surprises.
          </p>
        </div>
      </section>

      {/* Track C — Perpetual Licenses */}
      <section id="track-c" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-emerald-600 uppercase">
              Track C
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Perpetual Licenses
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Pay once, use forever. No subscription required. Support renewals are optional.
            </p>
          </div>
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PERPETUAL_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
              >
                {tier.comingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{tier.description}</p>
                <p className="mt-4 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-sm text-gray-500">{tier.priceNote}</span>
                </p>
                <p className="mt-1 text-xs text-gray-400">{tier.renewal}</p>
                <ul className="mt-6 mb-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <svg
                        className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5"
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
                  className="block w-full rounded-md bg-gray-100 px-4 py-2.5 text-center text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
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
