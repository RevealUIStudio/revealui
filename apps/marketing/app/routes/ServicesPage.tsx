import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators/ClosingCta';
import { DiscoveryScopeShip } from '../components/for-operators/DiscoveryScopeShip';
import { EngagementPricing } from '../components/for-operators/EngagementPricing';
import { Faq as ServicesFaq } from '../components/for-operators/Faq';
import { Hero as ServicesHero } from '../components/for-operators/Hero';
import { HowWeDeliver } from '../components/for-operators/HowWeDeliver';
import { Proof as ServicesProof } from '../components/for-operators/Proof';
import { WhatYouGet } from '../components/for-operators/WhatYouGet';

/**
 * Done-for-you services landing: `/services`. The operator pitch used to be
 * only reachable as the homepage's non-technical audience view; it now also
 * has its own URL, using the standalone for-operators Hero (eyebrow + reverse
 * link back to `/`) that predates the in-hero audience toggle. `?for=non-
 * technical` on `/` still serves the same underlying content as an alias.
 */
export function ServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <ServicesHero />
      <WhatYouGet />
      <HowWeDeliver />
      <EngagementPricing />
      <DiscoveryScopeShip />
      <ServicesProof />
      <ServicesFaq />
      <ClosingCta />
      <Footer />
    </div>
  );
}
