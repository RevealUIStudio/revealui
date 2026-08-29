import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { QuoteCalculator } from '../components/landing/QuoteCalculator';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Product homepage: one headline, Start free + GitHub, the three-question
 * quote calculator (defaults to self-host), the license teaser, slim footer.
 */
export function HomePage() {
  useAudienceHead('technical');
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <QuoteCalculator />
      <PricingTeaser />
      <Footer />
    </div>
  );
}
