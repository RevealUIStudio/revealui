import { MarketingSection } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import { QuoteCalculator } from '../components/landing/QuoteCalculator';
import { QUOTE_CALCULATOR } from '../content/quote-calculator';

/**
 * Pricing is the quote calculator. Leftover Fleet / Custom / kit storefront
 * is not rendered on this route.
 */
export function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingSection
        tone="background"
        density="spacious"
        width="default"
        className="relative overflow-hidden"
        innerClassName="max-w-4xl text-center"
      >
        <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {QUOTE_CALCULATOR.pricingHero.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-body sm:text-lg">
          {QUOTE_CALCULATOR.pricingHero.subtitle}
        </p>
      </MarketingSection>
      <QuoteCalculator />
      <Footer />
    </div>
  );
}
