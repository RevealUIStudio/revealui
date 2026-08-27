import type { PricingResponse } from '@revealui/contracts/public-catalog';
import {
  Button,
  MarketingSection,
  PricingTable,
  type PricingTier,
  SectionHeader,
} from '@revealui/presentation';
import { useEffect, useMemo, useState } from 'react';
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
 * Homepage pricing teaser: shared PricingTable for Free/Pro cards.
 * Max/Enterprise stay as quiet text links into /pricing.
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

  const tiers: PricingTier[] = useMemo(
    () =>
      PRICING_TEASER_TIERS.map((t) => {
        const { price, period } = prices[t.id];
        return {
          id: t.id,
          name: t.name,
          price,
          period,
          description: t.description,
          features: [...t.features],
          cta: t.cta,
          ctaHref: t.href,
          highlighted: t.highlight,
        };
      }),
    [prices],
  );

  return (
    <MarketingSection tone="secondary" density="default" width="default">
      <SectionHeader
        eyebrow={PRICING_TEASER_SECTION.eyebrow}
        eyebrowTone="muted"
        title={PRICING_TEASER_SECTION.heading}
        description={PRICING_TEASER_SECTION.body}
        align="center"
      />

      <div className="mx-auto mt-12 max-w-3xl sm:mt-14">
        <PricingTable tiers={tiers} highlightedLabel="Recommended" />
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
