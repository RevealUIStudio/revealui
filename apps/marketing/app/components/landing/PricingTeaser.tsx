import type { PricingResponse } from '@revealui/contracts/pricing';
import { Button, IconCheckCircle, MarketingSection, SectionHeader } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import {
  PRICING_TEASER_FOOTER,
  PRICING_TEASER_LINKS,
  PRICING_TEASER_SECTION,
  PRICING_TEASER_TIERS,
} from '../../content/pricing-teaser';
import { SUBSCRIPTION_PRICE_FALLBACKS } from '../../lib/pricing-fallbacks';

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

/**
 * Craft pass: drop the inverted (black) Pro card. Highlight with primary ring
 * and a quiet badge so the section stays calm on both light and dark themes.
 */
export function PricingTeaser() {
  const [prices, setPrices] = useState(SUBSCRIPTION_PRICE_FALLBACKS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/pricing`);
        if (!res.ok) return;
        const data = (await res.json()) as PricingResponse;
        if (cancelled) return;
        const next = { ...SUBSCRIPTION_PRICE_FALLBACKS };
        for (const tier of data.subscriptions) {
          if (tier.price) {
            next[tier.id] = { price: tier.price, period: tier.period };
          }
        }
        setPrices(next);
      } catch {
        // Fallback already in state.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MarketingSection tone="secondary" density="default" width="default">
      <SectionHeader
        eyebrow={PRICING_TEASER_SECTION.eyebrow}
        eyebrowTone="muted"
        title={PRICING_TEASER_SECTION.heading}
        description={PRICING_TEASER_SECTION.body}
        align="center"
      />

      <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6">
        {PRICING_TEASER_TIERS.map((t) => {
          const { price, period } = prices[t.id];
          return (
            <div
              key={t.id}
              className={`relative flex flex-col rounded-2xl bg-card p-7 ring-1 ring-border/80 transition sm:p-8 ${
                t.highlight ? 'shadow-md shadow-foreground/5' : ''
              }`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-foreground ring-1 ring-border">
                  Recommended
                </div>
              )}
              <h3 className="font-display text-lg font-semibold text-foreground">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {price}
                </span>
                {period && <span className="text-sm text-muted-foreground">{period}</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{t.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <IconCheckCircle size="sm" className="mt-0.5 flex-shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {t.highlight ? (
                  <Button asChild size="default" className="w-full">
                    <a href={t.href}>{t.cta}</a>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="default"
                    appearance="outline"
                    variant="neutral"
                    className="w-full"
                  >
                    <a href={t.href}>{t.cta}</a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-center gap-2 text-sm sm:flex-row sm:gap-6">
        {PRICING_TEASER_LINKS.map((tier) => (
          <a key={tier.id} href={tier.href} className="text-muted-foreground hover:text-foreground">
            <span className="font-medium text-foreground">{tier.name}</span> {tier.description}
          </a>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Button
          asChild
          appearance="link"
          size="default"
          className="items-center justify-center text-sm font-medium"
        >
          <a href={PRICING_TEASER_FOOTER.moreHref}>{PRICING_TEASER_FOOTER.moreLabel}</a>
        </Button>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {PRICING_TEASER_FOOTER.caption.prefix}{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {PRICING_TEASER_FOOTER.caption.code}
          </code>{' '}
          {PRICING_TEASER_FOOTER.caption.suffix}
        </p>
      </div>
    </MarketingSection>
  );
}
