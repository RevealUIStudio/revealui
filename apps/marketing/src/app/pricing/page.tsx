import {
  CREDIT_BUNDLES,
  PERPETUAL_TIERS,
  type PricingResponse,
  SERVICE_OFFERINGS,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';
import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { NewsletterSignup } from '@/components/NewsletterSignup';

export const metadata: Metadata = {
  title: 'Pricing — RevealUI',
  description:
    'Start free. Subscribe, pay per agent task, buy a one-time license, or book expert services. Four ways to use RevealUI — pick what fits your business.',
  openGraph: {
    title: 'Pricing — RevealUI',
    description:
      'Start free. Subscribe, pay per agent task, buy a one-time license, or book expert services. Four ways to use RevealUI.',
    type: 'website',
  },
};

// Resolve CTA hrefs for marketing context (absolute URLs for signup)
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.revealui.com';

const PRICING_CACHE_REVALIDATE_S = 3600; // 1 hour

async function getPricing(): Promise<PricingResponse | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com';
  try {
    const res = await fetch(`${apiUrl}/api/pricing`, {
      next: { revalidate: PRICING_CACHE_REVALIDATE_S },
    });
    if (!res.ok) return null;
    return (await res.json()) as PricingResponse;
  } catch {
    return null;
  }
}

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
    question: 'How does AI inference work?',
    answer:
      'RevealUI runs AI on open models only — no proprietary cloud APIs, no vendor lock-in, no API bills. The recommended path is Ubuntu Inference Snaps from Canonical: run "sudo snap install nemotron-3-nano" for instant local inference. Also supported: BitNet (1-bit quantized, CPU-only), Ollama (local), and cloud-hosted open models via the RevealUI harness (Pro+). Studio manages snap lifecycle, model switching, and multi-agent coordination.',
  },
  {
    question: 'What is Studio?',
    answer:
      'Studio is the native AI experience — a Tauri desktop app that orchestrates agents, manages Ubuntu Inference Snaps and local models, and provides a visual dashboard for multi-agent coordination. Available on Pro tier and above.',
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
  {
    question: 'What is the RevealUI ecosystem?',
    answer:
      'RevealUI is part of a four-project ecosystem. RevVault provides age-encrypted secret management (CLI free, desktop app Pro). RevKit provides portable dev environment provisioning (agent coordination protocol free, full provisioning Max). RevealCoin enables agent-native micropayments via the x402 protocol (Forge). Each project works independently — together they cover building, securing, and monetizing agentic software.',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PricingPage() {
  const pricing = await getPricing();

  const tiers = (pricing?.subscriptions ?? SUBSCRIPTION_TIERS).map((tier) => ({
    ...tier,
    ctaHref: tier.ctaHref.startsWith('/') ? `${adminUrl}${tier.ctaHref}` : tier.ctaHref,
  }));
  const creditBundles = pricing?.credits ?? CREDIT_BUNDLES;
  const perpetualTiers = pricing?.perpetual ?? PERPETUAL_TIERS;
  const services = pricing?.services ?? SERVICE_OFFERINGS;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Four ways to use
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RevealUI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            Subscribe monthly, pay per agent task, buy a perpetual license, or book expert services.
            Start free — upgrade when you need to.
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
            <a
              href="#track-d"
              className="rounded-full bg-amber-100 px-4 py-1.5 text-amber-700 hover:bg-amber-200 transition-colors"
            >
              Track D — Services
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
                      {tier.price ?? 'Contact us'}
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
            {creditBundles.map((bundle) => (
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
                  <span className="text-4xl font-bold text-gray-900">{bundle.price ?? '—'}</span>
                  <span className="text-sm text-gray-500">{bundle.priceNote ?? ''}</span>
                </p>
                <p className="mt-1 text-xl font-semibold text-purple-600">{bundle.tasks} tasks</p>
                <p className="mt-1 text-xs text-gray-500">{bundle.costPer ?? ''}</p>
                <a
                  href="https://admin.revealui.com/account/billing"
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
            <span className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">
              Track C
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Perpetual Licenses
            </h2>
            <span className="mt-2 inline-block text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              Coming soon
            </span>
            <p className="mt-4 text-lg text-gray-600">
              Pay once, use forever. No subscription required. Support renewals are optional.
            </p>
          </div>
          <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 sm:grid-cols-3">
            {perpetualTiers.map((tier) => (
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
                  <span className="text-4xl font-bold text-gray-900">{tier.price ?? '—'}</span>
                  <span className="text-sm text-gray-500">{tier.priceNote ?? ''}</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">{tier.renewal ?? '—'}</p>
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

      {/* For AI Agents */}
      <section id="for-agents" className="bg-gray-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold tracking-wide text-emerald-400 uppercase">
                Agent-Native
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                RevealUI for AI Agents
              </h2>
              <p className="mt-4 text-lg text-gray-400">
                Agents discover, authenticate, and pay without human intervention.
              </p>
              <span className="mt-3 inline-block text-xs font-semibold text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full ring-1 ring-amber-400/20">
                Coming soon
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Discovery */}
              <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <svg
                    className="h-5 w-5 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>Discovery</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">A2A Discovery</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Agents find RevealUI via a standard Agent Card at{' '}
                  <a
                    href="https://api.revealui.com/.well-known/agent.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline break-all"
                  >
                    /.well-known/agent.json
                  </a>
                  . Capabilities, skills, and pricing all machine-readable.
                </p>
              </div>

              {/* Payment */}
              <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>Payment</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">x402 Per-Call Payments</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Agents pay per task with RevealCoin on Solana via the HTTP 402 payment protocol.
                  No accounts, no subscriptions — pay exactly for what you use.
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  $0.001 per agent task · First 1,000/month free · Powered by RevealCoin
                </p>
              </div>

              {/* MCP */}
              <div className="rounded-2xl bg-gray-900 ring-1 ring-white/10 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20">
                  <svg
                    className="h-5 w-5 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>MCP</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.008-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0c.317 0 .573-.262.553-.578a48.14 48.14 0 0 0-.529-5.004.546.546 0 0 0-.574-.473 40.098 40.098 0 0 0-4.93.357.62.62 0 0 1-.658-.647v0Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">MCP Servers</h3>
                <p className="mt-2 text-sm text-gray-400">
                  12 production MCP servers including Stripe, Neon, Supabase, Vercel, Playwright,
                  Next.js DevTools, content management, and email. Marketplace discovery coming
                  soon.
                </p>
                <a
                  href="https://docs.revealui.com/mcp"
                  className="mt-3 inline-block text-xs font-semibold text-purple-400 hover:text-purple-300"
                >
                  MCP docs →
                </a>
              </div>
            </div>

            <div className="mt-10 text-center">
              <a
                href="https://api.revealui.com/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <title>API</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                  />
                </svg>
                OpenAPI spec
              </a>
              <a
                href="https://docs.revealui.com/api"
                className="ml-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                API docs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Track D — Professional Services */}
      <section id="track-d" className="bg-amber-50/50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-amber-700 uppercase">
              Track D
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Professional Services
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Expert help when you need it. Architecture reviews, migrations, launch support, and
              one-on-one consulting.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="relative rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200"
              >
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                {service.price && (
                  <p className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">{service.price}</span>
                    {service.priceNote && (
                      <span className="ml-1 text-sm text-gray-500">{service.priceNote}</span>
                    )}
                  </p>
                )}
                <p className="mt-4 text-sm text-gray-600">{service.description}</p>
                <ul className="mt-6 space-y-2">
                  {service.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        role="img"
                        aria-label="Included"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-gray-500 italic">{service.deliverable}</p>
                <a
                  href={service.ctaHref}
                  className="mt-6 block w-full rounded-md bg-amber-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
                >
                  {service.cta}
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

      {/* Final CTA */}
      <section className="bg-gray-950 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">
            Start free with full source code access. Upgrade when your business needs it.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`${adminUrl}/signup`}
              className="rounded-md bg-white px-8 py-4 text-base font-semibold text-gray-950 shadow-sm hover:bg-gray-100 transition-colors"
            >
              Get Started Free
            </a>
            <a
              href="/contact"
              className="rounded-md border border-gray-700 px-8 py-4 text-base font-semibold text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              Contact Sales
            </a>
          </div>
          <div className="mt-16 pt-10 border-t border-gray-800">
            <p className="text-sm font-medium text-gray-400 mb-4">
              Not ready yet? Stay in the loop.
            </p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
