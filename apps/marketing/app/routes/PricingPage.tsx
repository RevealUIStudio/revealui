import {
  Accordion,
  AccordionItem,
  Button,
  IconCheckCircle,
  IconCode,
  IconSearch,
  IconTerminal,
  MarketingSection,
  PricingTable,
  type PricingTier,
  SectionHeader,
} from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { CostCalculator } from '../components/landing/CostCalculator';
import { NewsletterSignup } from '../components/NewsletterSignup';
import {
  PERPETUAL_TIERS,
  PRICING_AGENCY_FOUNDING_KIT,
  PRICING_AGENCY_VALUE_BAND,
  PRICING_AGENT_A2A,
  PRICING_AGENT_CTA_LINKS,
  PRICING_AGENT_MCP,
  PRICING_AGENT_X402,
  PRICING_AGENTS_SECTION,
  PRICING_DONE_FOR_YOU,
  PRICING_FINAL_CTA,
  PRICING_FINAL_CTA_LINKS,
  PRICING_HERO,
  PRICING_HERO_NAV_ANCHORS,
  PRICING_HERO_SUBTEXT,
  PRICING_HIGHLIGHTED_BADGE,
  PRICING_NEWSLETTER_LABEL,
  PRICING_STARTER_KIT,
  PRICING_TRACK_A_SECTION,
  PRICING_TRACK_C_SECTION,
  PRICING_TRIAL_NOTE,
  PRICING_VALUE_BAND,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '../content/pricing';
import { PRICING_FAQ_SECTION, PRICING_FAQS } from '../content/pricing-faq';
import {
  ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS,
  PERPETUAL_PRICE_FALLBACKS,
  SUBSCRIPTION_PRICE_FALLBACKS,
} from '../lib/pricing-fallbacks';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL ?? 'https://admin.revealui.com';
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

export function PricingPage() {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

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

  // Show the annual toggle only after the API confirms annual prices are available
  // (i.e. the server has STRIPE_*_ANNUAL_PRICE_ID configured). This is the
  // "no annual CTA without a resolvable annual price" lockstep guard.
  const showAnnualToggle = pricing?.subscriptions.some((t) => Boolean(t.annualPrice)) ?? false;

  const tiers = (pricing?.subscriptions ?? SUBSCRIPTION_TIERS).map((tier) => {
    const fallback = SUBSCRIPTION_PRICE_FALLBACKS[tier.id];
    const annualFallback = ANNUAL_SUBSCRIPTION_PRICE_FALLBACKS[tier.id];
    const useAnnual = billingInterval === 'year' && tier.id !== 'free' && Boolean(tier.annualPrice);
    const baseHref = tier.ctaHref.startsWith('/') ? `${ADMIN_URL}${tier.ctaHref}` : tier.ctaHref;
    const ctaHref =
      useAnnual && baseHref.includes('/signup') ? `${baseHref}&interval=year` : baseHref;
    return {
      ...tier,
      price: useAnnual
        ? (tier.annualPrice ?? annualFallback?.price)
        : (tier.price ?? fallback?.price),
      period: useAnnual
        ? (tier.annualPeriod ?? annualFallback?.period)
        : (tier.period ?? fallback?.period),
      savings: useAnnual ? (annualFallback?.savings ?? '') : '',
      ctaHref,
    };
  });
  const perpetualTiers = (pricing?.perpetual ?? PERPETUAL_TIERS).map((tier) => {
    const fallback = PERPETUAL_PRICE_FALLBACKS[tier.name];
    return {
      ...tier,
      price: tier.price ?? fallback?.price,
      priceNote: tier.priceNote ?? fallback?.priceNote,
      renewal: tier.renewal ?? fallback?.renewal,
      ctaHref: tier.ctaHref.startsWith('/') ? `${ADMIN_URL}${tier.ctaHref}` : tier.ctaHref,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <MarketingSection
        tone="background"
        density="spacious"
        width="default"
        className="relative overflow-hidden"
        innerClassName="max-w-4xl text-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background"
        />
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Two ways to use{' '}
          <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            RevealUI
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-body sm:text-xl">
          {PRICING_HERO.subtitle}
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-body">
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
          {PRICING_HERO_NAV_ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="rounded-full bg-primary/10 px-4 py-1.5 text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/15"
            >
              {anchor.label}
            </a>
          ))}
        </div>
      </MarketingSection>

      {/* Subscriptions */}
      <MarketingSection id="subscriptions" tone="background" density="default" width="default">
        <SectionHeader
          eyebrow={PRICING_TRACK_A_SECTION.eyebrow}
          eyebrowTone="primary"
          title={PRICING_TRACK_A_SECTION.heading}
          description={PRICING_TRACK_A_SECTION.body}
          align="center"
          className="mb-10 sm:mb-12"
        />

        {/* Value band: you own the runtime (no competitor prices) */}
        <div className="mx-auto mb-10 max-w-4xl rounded-2xl bg-gradient-to-br from-primary/5 to-card p-6 ring-1 ring-primary/15 sm:mb-12 sm:p-8">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {PRICING_VALUE_BAND.heading}
          </h3>
          <p className="mt-3 text-sm leading-6 text-body">{PRICING_VALUE_BAND.body}</p>
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            {PRICING_VALUE_BAND.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-body">
                <IconCheckCircle className="mt-0.5 shrink-0 text-primary" size="md" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {showAnnualToggle && (
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1 text-sm font-medium ring-1 ring-border">
              <Button
                type="button"
                size="sm"
                appearance={billingInterval === 'month' ? 'solid' : 'ghost'}
                variant={billingInterval === 'month' ? 'neutral' : 'neutral'}
                onClick={() => setBillingInterval('month')}
                className="rounded-full"
              >
                Monthly
              </Button>
              <Button
                type="button"
                size="sm"
                appearance={billingInterval === 'year' ? 'solid' : 'ghost'}
                variant={billingInterval === 'year' ? 'neutral' : 'neutral'}
                onClick={() => setBillingInterval('year')}
                className="rounded-full"
              >
                Annually
                <span className="ml-1.5 rounded-full bg-success-strong px-1.5 py-0.5 text-xs font-semibold text-success-foreground">
                  Save 20%
                </span>
              </Button>
            </div>
          </div>
        )}

        <PricingTable
          tiers={tiers.map(
            (tier): PricingTier => ({
              id: tier.id,
              name: tier.name,
              price: tier.price ?? 'Contact us',
              period: tier.period,
              savings: tier.savings || undefined,
              description: tier.description,
              features: [...tier.features],
              cta: tier.cta,
              ctaHref: tier.ctaHref,
              highlighted: Boolean(tier.highlighted),
            }),
          )}
          highlightedLabel={PRICING_HIGHLIGHTED_BADGE}
        />

        <p className="mt-8 text-center text-sm text-muted-foreground">{PRICING_TRIAL_NOTE}</p>
      </MarketingSection>

      {/* Cost calculator: moved here from the homepage (internal marketing
          funnel audit, 2026-07-09), right after the value band above so the
          rented-stack ranges it produces are the one anchor number set for
          this comparison. */}
      <CostCalculator />

      {/* Perpetual licenses */}
      <MarketingSection id="perpetual" tone="secondary" density="default" width="default">
        <SectionHeader
          eyebrow={PRICING_TRACK_C_SECTION.eyebrow}
          eyebrowTone="primary"
          title={PRICING_TRACK_C_SECTION.heading}
          description={PRICING_TRACK_C_SECTION.body}
          align="center"
          className="mb-10 sm:mb-12"
        />

        {/* Studio / agency reseller value band: the multi-client P&L */}
        <div className="mx-auto mb-10 max-w-4xl rounded-2xl bg-gradient-to-br from-primary/5 to-card p-6 ring-1 ring-primary/15 sm:mb-12 sm:p-8">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            {PRICING_AGENCY_VALUE_BAND.eyebrow}
          </span>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {PRICING_AGENCY_VALUE_BAND.heading}
          </h3>
          <p className="mt-3 text-sm leading-6 text-body">{PRICING_AGENCY_VALUE_BAND.body}</p>
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            {PRICING_AGENCY_VALUE_BAND.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-body">
                <IconCheckCircle className="mt-0.5 shrink-0 text-primary" size="md" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {perpetualTiers.map((tier) => (
            <div
              key={tier.name}
              className="relative flex flex-col rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8"
            >
              {tier.comingSoon && (
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                    Coming soon
                  </span>
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
              <p className="mt-1 text-sm text-body">{tier.description}</p>
              {tier.price ? (
                <p className="mt-4 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                  {tier.priceNote && (
                    <span className="text-sm text-muted-foreground">{tier.priceNote}</span>
                  )}
                </p>
              ) : (
                <p className="mt-4 text-base font-semibold text-foreground">Contact for pricing</p>
              )}
              {tier.renewal && <p className="mt-1 text-xs text-muted-foreground">{tier.renewal}</p>}
              <ul className="mb-8 mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-x-3">
                    <IconCheckCircle className="mt-0.5 shrink-0 text-primary" size="md" />
                    <span className="text-sm text-body">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                appearance="outline"
                variant="neutral"
                size="default"
                className="w-full"
              >
                <a href={tier.ctaHref}>{tier.cta}</a>
              </Button>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* For AI Agents */}
      <MarketingSection id="for-agents" tone="secondary" density="default" width="default">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center sm:mb-12">
            <SectionHeader
              eyebrow={PRICING_AGENTS_SECTION.eyebrow}
              eyebrowTone="primary"
              title={PRICING_AGENTS_SECTION.heading}
              description={PRICING_AGENTS_SECTION.subhead}
              align="center"
            />
            <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30">
              {PRICING_AGENTS_SECTION.badge}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <IconSearch size="md" className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {PRICING_AGENT_A2A.heading}
              </h3>
              <p className="mt-2 text-sm text-body">
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

            <div className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <IconCode size="md" className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {PRICING_AGENT_X402.heading}
              </h3>
              <p className="mt-2 text-sm text-body">{PRICING_AGENT_X402.body}</p>
            </div>

            <div className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <IconTerminal size="md" className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {PRICING_AGENT_MCP.heading}
              </h3>
              <p className="mt-2 text-sm text-body">{PRICING_AGENT_MCP.body}</p>
              <a
                href={PRICING_AGENT_MCP.docsLink.href}
                className="mt-3 inline-block text-xs font-semibold text-primary hover:text-primary/80"
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
              <IconCode size="sm" />
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
      </MarketingSection>

      {/* GAP-434 Starter Kit — one-time content product (Stripe Payment Link) */}
      <MarketingSection id="starter-kit" tone="background" density="default" width="default">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              {PRICING_STARTER_KIT.eyebrow}
            </span>
            {PRICING_STARTER_KIT.badge ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                {PRICING_STARTER_KIT.badge}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PRICING_STARTER_KIT.heading}
          </h2>
          <p className="mt-4 flex items-baseline gap-x-2">
            <span className="text-4xl font-bold text-foreground">{PRICING_STARTER_KIT.price}</span>
            <span className="text-sm text-muted-foreground">{PRICING_STARTER_KIT.priceNote}</span>
          </p>
          <p className="mt-4 text-lg text-body">{PRICING_STARTER_KIT.body}</p>
          <ul className="mt-6 space-y-3">
            {PRICING_STARTER_KIT.points.map((point) => (
              <li key={point} className="flex items-start gap-x-3">
                <IconCheckCircle className="mt-0.5 shrink-0 text-primary" size="md" />
                <span className="text-sm text-body">{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a
                href={PRICING_STARTER_KIT.primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {PRICING_STARTER_KIT.primaryCta.label}
              </a>
            </Button>
            <Button
              asChild
              appearance="outline"
              variant="neutral"
              size="lg"
              className="w-full sm:w-auto"
            >
              <a
                href={PRICING_STARTER_KIT.secondaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {PRICING_STARTER_KIT.secondaryCta.label}
              </a>
            </Button>
          </div>
        </div>
      </MarketingSection>

      {/* GAP-448 Agency Founding Kit — Agency Perpetual self-serve path */}
      <MarketingSection id="agency-founding-kit" tone="secondary" density="default" width="default">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            {PRICING_AGENCY_FOUNDING_KIT.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PRICING_AGENCY_FOUNDING_KIT.heading}
          </h2>
          <p className="mt-4 flex items-baseline gap-x-2">
            <span className="text-4xl font-bold text-foreground">
              {PRICING_AGENCY_FOUNDING_KIT.price}
            </span>
            <span className="text-sm text-muted-foreground">
              {PRICING_AGENCY_FOUNDING_KIT.priceNote}
            </span>
          </p>
          <p className="mt-4 text-lg text-body">{PRICING_AGENCY_FOUNDING_KIT.body}</p>
          <ul className="mt-6 space-y-3">
            {PRICING_AGENCY_FOUNDING_KIT.points.map((point) => (
              <li key={point} className="flex items-start gap-x-3">
                <IconCheckCircle className="mt-0.5 shrink-0 text-primary" size="md" />
                <span className="text-sm text-body">{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <a
                href={PRICING_AGENCY_FOUNDING_KIT.primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {PRICING_AGENCY_FOUNDING_KIT.primaryCta.label}
              </a>
            </Button>
            <Button
              asChild
              appearance="outline"
              variant="neutral"
              size="lg"
              className="w-full sm:w-auto"
            >
              <a href={PRICING_AGENCY_FOUNDING_KIT.secondaryCta.href}>
                {PRICING_AGENCY_FOUNDING_KIT.secondaryCta.label}
              </a>
            </Button>
          </div>
        </div>
      </MarketingSection>

      {/* Done-for-you rung: services ladder + discovery-call capture */}
      <MarketingSection
        id="done-for-you"
        tone="background"
        density="default"
        width="default"
        className="bg-primary/5"
      >
        <SectionHeader
          eyebrow={PRICING_DONE_FOR_YOU.eyebrow}
          eyebrowTone="primary"
          title={PRICING_DONE_FOR_YOU.heading}
          description={PRICING_DONE_FOR_YOU.body}
          align="center"
          className="mb-10 sm:mb-12"
        />

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {PRICING_DONE_FOR_YOU.rungs.map((rung) => (
            <div key={rung.name} className="rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">
              <h3 className="text-base font-semibold text-foreground">{rung.name}</h3>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{rung.price}</p>
              <p className="mt-3 text-sm text-body">{rung.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a
              href={PRICING_DONE_FOR_YOU.primaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {PRICING_DONE_FOR_YOU.primaryCta.label}
            </a>
          </Button>
          <Button
            asChild
            appearance="outline"
            variant="neutral"
            size="lg"
            className="w-full sm:w-auto"
          >
            <a
              href={PRICING_DONE_FOR_YOU.secondaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {PRICING_DONE_FOR_YOU.secondaryCta.label}
            </a>
          </Button>
        </div>
      </MarketingSection>

      {/* FAQ Section */}
      <MarketingSection tone="background" density="default" width="default">
        <div className="mx-auto max-w-4xl">
          <SectionHeader
            title={PRICING_FAQ_SECTION.heading}
            align="center"
            className="mb-10 sm:mb-12"
          />
          <Accordion className="rounded-2xl bg-card px-4 ring-1 ring-border sm:px-6">
            {PRICING_FAQS.map((faq) => (
              <AccordionItem
                key={faq.question}
                title={
                  <span className="text-base font-semibold leading-7 text-foreground sm:text-lg">
                    {faq.question}
                  </span>
                }
              >
                <p className="text-base leading-7 text-body">{faq.answer}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </MarketingSection>

      {/* Final CTA */}
      <MarketingSection tone="secondary" density="default" width="narrow">
        <SectionHeader
          title={PRICING_FINAL_CTA.title}
          description={PRICING_FINAL_CTA.subtitle}
          align="center"
          className="mb-10 sm:mb-12"
        />
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a
              href={
                PRICING_FINAL_CTA_LINKS.getStarted.href.startsWith('/')
                  ? `${ADMIN_URL}${PRICING_FINAL_CTA_LINKS.getStarted.href}`
                  : PRICING_FINAL_CTA_LINKS.getStarted.href
              }
            >
              {PRICING_FINAL_CTA_LINKS.getStarted.label}
            </a>
          </Button>
          <Button
            asChild
            appearance="outline"
            variant="neutral"
            size="lg"
            className="w-full sm:w-auto"
          >
            <a href={PRICING_FINAL_CTA_LINKS.contactSales.href}>
              {PRICING_FINAL_CTA_LINKS.contactSales.label}
            </a>
          </Button>
        </div>
        <div className="mt-12 border-t border-border pt-10 text-center sm:mt-14">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            {PRICING_NEWSLETTER_LABEL}
          </p>
          <NewsletterSignup variant="stacked" />
        </div>
      </MarketingSection>

      <Footer />
    </div>
  );
}
