import type { LicenseTierId } from '@revealui/contracts/pricing';
import { ButtonCVA } from '@revealui/presentation';
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
  PRICING_FINAL_CTA,
  PRICING_FINAL_CTA_LINKS,
  PRICING_HERO,
  PRICING_HERO_NAV_ANCHORS,
  PRICING_HERO_SUBTEXT,
  PRICING_HIGHLIGHTED_BADGE,
  PRICING_NEWSLETTER_LABEL,
  PRICING_TRACK_A_SECTION,
  PRICING_TRACK_C_SECTION,
  PRICING_VALUE_BAND,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '../content/pricing';
import { PRICING_FAQ_SECTION, PRICING_FAQS } from '../content/pricing-faq';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'https://admin.revealui.com';
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

// Fallback prices shown when /api/pricing is unreachable (local dev without the API
// running, or a transient API error) — without this the cards render "Contact us" for
// every tier. Mirrors TEASER_FALLBACK_PRICE (PricingTeaser.tsx) and
// HARDCODED_SUBSCRIPTION_PRICES in apps/server/src/routes/pricing.ts. Stripe Dashboard
// is canonical; the billing-readiness cron drift-checks these.
const FALLBACK_PRICE: Record<LicenseTierId, { price: string; period?: string }> = {
  free: { price: '$0' },
  pro: { price: '$49', period: '/month' },
  max: { price: '$149', period: '/month' },
  enterprise: { price: '$299', period: '/month' },
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <title>Included</title>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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

  const tiers = (pricing?.subscriptions ?? SUBSCRIPTION_TIERS).map((tier) => {
    const fallback = FALLBACK_PRICE[tier.id];
    return {
      ...tier,
      price: tier.price ?? fallback?.price,
      period: tier.period ?? fallback?.period,
      ctaHref: tier.ctaHref.startsWith('/') ? `${ADMIN_URL}${tier.ctaHref}` : tier.ctaHref,
    };
  });
  const perpetualTiers = pricing?.perpetual ?? PERPETUAL_TIERS;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Two ways to use{' '}
            <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              RevealUI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            {PRICING_HERO.subtitle}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            {PRICING_HERO_SUBTEXT.prefix}{' '}
            <a
              href={PRICING_HERO_SUBTEXT.linkHref}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
            >
              {PRICING_HERO_SUBTEXT.linkLabel}
            </a>{' '}
            {PRICING_HERO_SUBTEXT.suffix}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-medium">
            <a
              href={PRICING_HERO_NAV_ANCHORS[0].href}
              className="rounded-full bg-primary/10 px-4 py-1.5 text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
            >
              {PRICING_HERO_NAV_ANCHORS[0].label}
            </a>
            <a
              href={PRICING_HERO_NAV_ANCHORS[1].href}
              className="rounded-full bg-primary/10 px-4 py-1.5 text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
            >
              {PRICING_HERO_NAV_ANCHORS[1].label}
            </a>
          </div>
        </div>
      </section>

      {/* Subscriptions */}
      <section id="subscriptions" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              {PRICING_TRACK_A_SECTION.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {PRICING_TRACK_A_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{PRICING_TRACK_A_SECTION.body}</p>
          </div>

          {/* Value band — you own the runtime (no competitor prices) */}
          <div className="mx-auto mb-16 max-w-4xl rounded-2xl bg-gradient-to-br from-primary/5 to-card p-8 ring-1 ring-primary/15">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {PRICING_VALUE_BAND.heading}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {PRICING_VALUE_BAND.body}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PRICING_VALUE_BAND.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl bg-card p-8 shadow-lg ${
                  tier.highlighted ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-primary px-3 py-1.5 text-center text-sm font-semibold text-primary-foreground shadow-lg">
                    {PRICING_HIGHLIGHTED_BADGE}
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">{tier.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                  <p className="mt-6 flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground">
                      {tier.price ?? 'Contact us'}
                    </span>
                    {tier.period && (
                      <span className="text-sm text-muted-foreground">{tier.period}</span>
                    )}
                  </p>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                {tier.highlighted ? (
                  <ButtonCVA asChild size="default" className="w-full">
                    <a
                      href={tier.ctaHref}
                      target={tier.id === 'free' ? '_blank' : undefined}
                      rel={tier.id === 'free' ? 'noopener noreferrer' : undefined}
                    >
                      {tier.cta}
                    </a>
                  </ButtonCVA>
                ) : (
                  <ButtonCVA asChild variant="outline" size="default" className="w-full">
                    <a
                      href={tier.ctaHref}
                      target={tier.id === 'free' ? '_blank' : undefined}
                      rel={tier.id === 'free' ? 'noopener noreferrer' : undefined}
                    >
                      {tier.cta}
                    </a>
                  </ButtonCVA>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perpetual licenses */}
      <section id="perpetual" className="bg-secondary py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              {PRICING_TRACK_C_SECTION.eyebrow}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {PRICING_TRACK_C_SECTION.heading}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{PRICING_TRACK_C_SECTION.body}</p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {perpetualTiers.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col rounded-2xl bg-card p-8 shadow-lg ring-1 ring-border"
              >
                {tier.comingSoon && (
                  <div className="absolute right-4 top-4">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Coming soon
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                {tier.price ? (
                  <p className="mt-4 flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                    {tier.priceNote && (
                      <span className="text-sm text-muted-foreground">{tier.priceNote}</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-4 text-base font-semibold text-foreground">
                    Contact for pricing
                  </p>
                )}
                {tier.renewal && (
                  <p className="mt-1 text-xs text-muted-foreground">{tier.renewal}</p>
                )}
                <ul className="mb-8 mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <ButtonCVA asChild variant="outline" size="default" className="w-full">
                  <a href={tier.ctaHref}>{tier.cta}</a>
                </ButtonCVA>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For AI Agents */}
      <section id="for-agents" className="bg-secondary py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                {PRICING_AGENTS_SECTION.eyebrow}
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {PRICING_AGENTS_SECTION.heading}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{PRICING_AGENTS_SECTION.subhead}</p>
              <span className="mt-3 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/30">
                {PRICING_AGENTS_SECTION.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <title>Discovery</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {PRICING_AGENT_A2A.heading}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {PRICING_AGENT_A2A.body.prefix}{' '}
                  <a
                    href={PRICING_AGENT_A2A.body.linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline hover:text-primary/80"
                  >
                    {PRICING_AGENT_A2A.body.linkLabel}
                  </a>
                  {PRICING_AGENT_A2A.body.suffix}
                </p>
              </div>

              <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <title>Payment</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {PRICING_AGENT_X402.heading}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{PRICING_AGENT_X402.body}</p>
              </div>

              <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                  <svg
                    className="h-5 w-5 text-violet-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <title>MCP</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.008-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0c.317 0 .573-.262.553-.578a48.14 48.14 0 0 0-.529-5.004.546.546 0 0 0-.574-.473 40.098 40.098 0 0 0-4.93.357.62.62 0 0 1-.658-.647v0Z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {PRICING_AGENT_MCP.heading}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{PRICING_AGENT_MCP.body}</p>
                <a
                  href={PRICING_AGENT_MCP.docsLink.href}
                  className="mt-3 inline-block text-xs font-semibold text-violet-600 hover:text-violet-700"
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
                className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
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
                className="ml-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {PRICING_AGENT_CTA_LINKS.apiDocs.label}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Need implementation help? Hand off to the agency. */}
      <section className="bg-primary/5 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {PRICING_AGENCY_SECTION.heading}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">{PRICING_AGENCY_SECTION.body}</p>
          <div className="mt-8">
            <ButtonCVA asChild variant="outline" size="lg">
              <a href={PRICING_AGENCY_SECTION.cta.href} target="_blank" rel="noopener noreferrer">
                {PRICING_AGENCY_SECTION.cta.label}
              </a>
            </ButtonCVA>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-background py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {PRICING_FAQ_SECTION.heading}
            </h2>
            <dl className="space-y-8">
              {PRICING_FAQS.map((faq) => (
                <div key={faq.question} className="rounded-lg bg-secondary p-6 ring-1 ring-border">
                  <dt className="mb-2 text-lg font-semibold text-foreground">{faq.question}</dt>
                  <dd className="text-base text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-secondary py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PRICING_FINAL_CTA.title}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {PRICING_FINAL_CTA.subtitle}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonCVA asChild size="lg" className="w-full sm:w-auto">
              <a href={`${ADMIN_URL}${PRICING_FINAL_CTA_LINKS.getStarted.href}`}>
                {PRICING_FINAL_CTA_LINKS.getStarted.label}
              </a>
            </ButtonCVA>
            <ButtonCVA asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href={PRICING_FINAL_CTA_LINKS.contactSales.href}>
                {PRICING_FINAL_CTA_LINKS.contactSales.label}
              </a>
            </ButtonCVA>
          </div>
          <div className="mt-16 border-t border-border pt-10">
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              {PRICING_NEWSLETTER_LABEL}
            </p>
            <NewsletterSignup variant="stacked" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
