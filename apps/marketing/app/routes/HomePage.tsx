import { Footer } from '../components/Footer';
import { Hero } from '../components/landing/Hero';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Product homepage: one headline, Start free + GitHub, the license teaser
 * (Free / Pro / Max / Enterprise), slim footer. Studio SKUs are not here.
 */
export function HomePage() {
  useAudienceHead('technical');
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <PricingTeaser />
      <Footer />
    </div>
  );
}
