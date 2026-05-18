import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { NewsletterSignup } from '../components/NewsletterSignup';
import {
  PERPETUAL_TIERS,
  PRICING_AGENCY_SECTION,
  PRICING_AGENT_A2A,
  PRICING_AGENT_CTA_LINKS,
  PRICING_AGENT_MCP,
  PRICING_AGENT_X402,
  PRICING_AGENTS_SECTION,
  PRICING_CFO_PANEL,
  PRICING_FINAL_CTA,
  PRICING_FINAL_CTA_LINKS,
  PRICING_HERO,
  PRICING_HERO_NAV_ANCHORS,
  PRICING_HERO_SUBTEXT,
  PRICING_HIGHLIGHTED_BADGE,
  PRICING_NEWSLETTER_LABEL,
  PRICING_TRACK_A_SECTION,
  PRICING_TRACK_C_SECTION,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '../content/pricing';
import { PRICING_FAQ_SECTION, PRICING_FAQS } from '../content/pricing-faq';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'https://admin.revealui.com';
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

export function PricingPage() {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/pricing`)
      .then((r) => (r.ok ? (r.json() as Promise<PricingResponse>) : null))
      .then((data) => {
        if (!cancelled && data) setPricing(data);
      })
      .catch(() => {
        // Fallback to static contract data already in state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiers = (pricing?.subscriptions ?? SUBSCRIPTION_TIERS).map((tier) => ({
    ...tier,
    ctaHref: tier.ctaHref.startsWith('/') ? `${ADMIN_URL}${tier.ctaHref}` : tier.ctaHref,
  }));
  const perpetualTiers = pricing?.perpetual ?? PERPETUAL_TIERS;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Two ways to use
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RevealUI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 sm:text-xl">
            {PRICING_HERO.subtitle}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-500">
            {PRICING_HERO_SUBTEXT.prefix}{' '}
            <a
              href={PRICING_HERO_SUBTEXT.linkHref}
              className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800"
            >
              {PRICING_HERO_SUBTEXT.linkLabel}
            </a>{' '}
            {PRICING_HERO_SUBTEXT.suffix}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-medium">
            <a
              href={PRICING_HERO_NAV_ANCHORS[0].href}
              className="rounded-full bg-blue-100 px-4 py-1.5 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              {PRICING_HERO_NAV_ANCHORS[0].label}
            </a>
            <a
              href={PRICING_HERO_NAV_ANCHORS[1].href}
              className="rounded-full bg-emerald-100 px-4 py-1.5 text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              {PRICING_HERO_NAV_ANCHORS[1].label}
            </a>
          </div>
        </div>
      </section>

      {/* Track A: Subscription tiers */}
      <section id="track-a" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-blue-600 uppercase">
              {PRICING_TRACK_A_SECTION.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {PRICING_TRACK_A_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-gray-600">{PRICING_TRACK_A_SECTION.body}</p>
          </div>

          {/* CFO comparison panel — replacing-what reframe */}
          <div className="mx-auto mb-16 max-w-4xl rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8 ring-1 ring-blue-200">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              {PRICING_CFO_PANEL.eyebrow}
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-gray-950">
              {PRICING_CFO_PANEL.heading}
            </h3>
            <ul className="mt-6 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
              {PRICING_CFO_PANEL.lineItems.map((item, i) => (
                <li
                  key={item.label}
                  className={`flex items-baseline gap-2${i === PRICING_CFO_PANEL.lineItems.length - 1 ? ' sm:col-span-2' : ''}`}
                >
                  <span className="text-gray-500">&bull;</span>
                  <span>
                    <span className="font-semibold text-gray-900">{item.label}</span> {item.amount}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-blue-200">
              <p className="text-sm leading-6 text-gray-700">{PRICING_CFO_PANEL.totalLine}</p>
              <p className="mt-3 text-base font-semibold text-emerald-800">
                {PRICING_CFO_PANEL.bottomLine}
              </p>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-600">
              <em>{PRICING_CFO_PANEL.footnote}</em>
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
                    {PRICING_HIGHLIGHTED_BADGE}
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

      {/* Track C: Perpetual Licenses */}
      <section id="track-c" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">
              {PRICING_TRACK_C_SECTION.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {PRICING_TRACK_C_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-gray-600">{PRICING_TRACK_C_SECTION.body}</p>
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
                  <span className="text-4xl font-bold text-gray-900">{tier.price ?? ' - '}</span>
                  <span className="text-sm text-gray-500">{tier.priceNote ?? ''}</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">{tier.renewal ?? ' - '}</p>
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
                {PRICING_AGENTS_SECTION.eyebrow}
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {PRICING_AGENTS_SECTION.heading}
              </h2>
              <p className="mt-4 text-lg text-gray-400">{PRICING_AGENTS_SECTION.subhead}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full ring-1 ring-amber-400/20">
                {PRICING_AGENTS_SECTION.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
                <h3 className="text-base font-semibold text-white">{PRICING_AGENT_A2A.heading}</h3>
                <p className="mt-2 text-sm text-gray-400">
                  {PRICING_AGENT_A2A.body.prefix}{' '}
                  <a
                    href={PRICING_AGENT_A2A.body.linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline break-all"
                  >
                    {PRICING_AGENT_A2A.body.linkLabel}
                  </a>
                  {PRICING_AGENT_A2A.body.suffix}
                </p>
              </div>

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
                <h3 className="text-base font-semibold text-white">{PRICING_AGENT_X402.heading}</h3>
                <p className="mt-2 text-sm text-gray-400">{PRICING_AGENT_X402.body}</p>
                <p className="mt-3 text-xs text-gray-400">
                  {PRICING_AGENT_X402.footnote.prefix}{' '}
                  <a
                    href={PRICING_AGENT_X402.footnote.linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    {PRICING_AGENT_X402.footnote.linkLabel}
                  </a>{' '}
                  {PRICING_AGENT_X402.footnote.suffix}
                </p>
              </div>

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
                <h3 className="text-base font-semibold text-white">{PRICING_AGENT_MCP.heading}</h3>
                <p className="mt-2 text-sm text-gray-400">{PRICING_AGENT_MCP.body}</p>
                <a
                  href={PRICING_AGENT_MCP.docsLink.href}
                  className="mt-3 inline-block text-xs font-semibold text-purple-400 hover:text-purple-300"
                >
                  {PRICING_AGENT_MCP.docsLink.label}
                </a>
              </div>
            </div>

            <div className="mt-10 text-center">
              <a
                href={PRICING_AGENT_CTA_LINKS.openapi.href}
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
                {PRICING_AGENT_CTA_LINKS.openapi.label}
              </a>
              <a
                href={PRICING_AGENT_CTA_LINKS.apiDocs.href}
                className="ml-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                {PRICING_AGENT_CTA_LINKS.apiDocs.label}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Need implementation help? Hand off to the agency. */}
      <section className="bg-amber-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {PRICING_AGENCY_SECTION.heading}
          </h2>
          <p className="mt-4 text-base text-gray-600">{PRICING_AGENCY_SECTION.body}</p>
          <div className="mt-8">
            <a
              href={PRICING_AGENCY_SECTION.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
            >
              {PRICING_AGENCY_SECTION.cta.label}
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center mb-12">
              {PRICING_FAQ_SECTION.heading}
            </h2>
            <dl className="space-y-8">
              {PRICING_FAQS.map((faq) => (
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
            {PRICING_FINAL_CTA.title}
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-400">{PRICING_FINAL_CTA.subtitle}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`${ADMIN_URL}${PRICING_FINAL_CTA_LINKS.getStarted.href}`}
              className="rounded-md bg-white px-8 py-4 text-base font-semibold text-gray-950 shadow-sm hover:bg-gray-100 transition-colors"
            >
              {PRICING_FINAL_CTA_LINKS.getStarted.label}
            </a>
            <a
              href={PRICING_FINAL_CTA_LINKS.contactSales.href}
              className="rounded-md border border-gray-700 px-8 py-4 text-base font-semibold text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              {PRICING_FINAL_CTA_LINKS.contactSales.label}
            </a>
          </div>
          <div className="mt-16 pt-10 border-t border-gray-800">
            <p className="text-sm font-medium text-gray-400 mb-4">{PRICING_NEWSLETTER_LABEL}</p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
