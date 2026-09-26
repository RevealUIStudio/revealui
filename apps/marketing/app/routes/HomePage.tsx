import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { QuoteCalculator } from '../components/landing/QuoteCalculator';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Product homepage: one headline, Start free + GitHub, the license quote
 * (defaults to self-host; Studio is an outbound path), the license teaser, slim footer.
 */
export function HomePage() {
  useAudienceHead('technical');
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <QuoteCalculator surface="home" />
      <PricingTeaser />
      <Footer />
    </div>
  );
}
