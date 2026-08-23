import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { QuoteCalculator } from '../components/landing/QuoteCalculator';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Product homepage (founder weekend spec): one headline, the quote calculator
 * (defaults to “I will”), Start free + GitHub, one continuity sentence, slim footer.
 */
export function HomePage() {
  useAudienceHead('technical');
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <QuoteCalculator />
      <Footer />
    </div>
  );
}
