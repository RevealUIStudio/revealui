import type { LicenseTierId, PricingResponse } from '@revealui/contracts/pricing';
import { ButtonCVA } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import {
  PRICING_TEASER_FOOTER,
  PRICING_TEASER_SECTION,
  PRICING_TEASER_TIERS,
} from '../../content/pricing-teaser';

// Fallback used when /api/pricing is unreachable. Mirrors HARDCODED_SUBSCRIPTION_PRICES
// in apps/server/src/routes/pricing.ts. The billing-readiness cron drift-checks the API
// hardcodes against Stripe; keep these in sync when that cron fires. Stripe Dashboard
// is the canonical source of truth.
const TEASER_FALLBACK_PRICE: Record<LicenseTierId, { price: string; period?: string }> = {
  free: { price: '$0' },
  pro: { price: '$49', period: '/month' },
  max: { price: '$149', period: '/month' },
  enterprise: { price: '$299', period: '/month' },
};

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004');

export function PricingTeaser() {
  const [prices, setPrices] = useState(TEASER_FALLBACK_PRICE);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/pricing`);
        if (!res.ok) return;
        const data = (await res.json()) as PricingResponse;
        if (cancelled) return;
        const next = { ...TEASER_FALLBACK_PRICE };
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
    <section className="bg-secondary py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {PRICING_TEASER_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {PRICING_TEASER_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {PRICING_TEASER_SECTION.body}
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {PRICING_TEASER_TIERS.map((t) => {
            const { price, period } = prices[t.id];
            return (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-2xl p-8 ring-1 transition ${
                  t.highlight
                    ? 'bg-foreground text-background ring-foreground shadow-xl'
                    : 'bg-card text-foreground ring-border hover:ring-border/80'
                }`}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">{price}</span>
                  {period && (
                    <span
                      className={`text-sm ${t.highlight ? 'text-background/60' : 'text-muted-foreground'}`}
                    >
                      {period}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-4 text-sm leading-6 ${
                    t.highlight ? 'text-background/70' : 'text-muted-foreground'
                  }`}
                >
                  {t.description}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-sm ${
                        t.highlight ? 'text-background/80' : 'text-foreground'
                      }`}
                    >
                      <svg
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                          t.highlight ? 'text-primary' : 'text-primary'
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
                      className="w-full bg-background text-foreground hover:bg-secondary"
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
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <ButtonCVA
            asChild
            variant="link"
            size="default"
            className="items-center justify-center text-sm font-medium"
          >
            <a href={PRICING_TEASER_FOOTER.moreHref}>{PRICING_TEASER_FOOTER.moreLabel}</a>
          </ButtonCVA>
          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            {PRICING_TEASER_FOOTER.caption.prefix}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {PRICING_TEASER_FOOTER.caption.code}
            </code>{' '}
            {PRICING_TEASER_FOOTER.caption.suffix}
          </p>
        </div>
      </div>
    </section>
  );
}
