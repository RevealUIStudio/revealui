import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators/ClosingCta';
import { DiscoveryScopeShip } from '../components/for-operators/DiscoveryScopeShip';
import { EngagementPricing } from '../components/for-operators/EngagementPricing';
import { Faq as ServicesFaq } from '../components/for-operators/Faq';
import { Hero as ServicesHero } from '../components/for-operators/Hero';
import { HowWeDeliver } from '../components/for-operators/HowWeDeliver';
import { Proof as ServicesProof } from '../components/for-operators/Proof';
import { WhatYouGet } from '../components/for-operators/WhatYouGet';
import {
  SERVICES_FALLBACK_BLOCKS,
  servicesCtaSlot,
  servicesDiscoverySlot,
  servicesFaqSlot,
  servicesHeroSlot,
  servicesHowWeDeliverSlot,
  servicesPricingIntroSlot,
  servicesProofSlot,
  servicesWhatYouGetSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

/**
 * Done-for-you services landing: `/services`. The operator pitch used to be
 * only reachable as the homepage's non-technical audience view; it now also
 * has its own URL, using the standalone for-operators Hero (eyebrow + reverse
 * link back to `/`) that predates the in-hero audience toggle. `?for=non-
 * technical` on `/` still serves the same underlying content as a static alias
 * (CMS wire lives only here).
 *
 * Narrative sections are CMS-wired via useMarketingPageBlocks (VES residual).
 * Engagement ladder rungs stay component-local (price anchors from contracts).
 */
export function ServicesPage() {
  const { blocks, annotation } = useMarketingPageBlocks('services', SERVICES_FALLBACK_BLOCKS);
  const hero = servicesHeroSlot(blocks);
  const whatYouGet = servicesWhatYouGetSlot(blocks);
  const howWeDeliver = servicesHowWeDeliverSlot(blocks);
  const pricingIntro = servicesPricingIntroSlot(blocks);
  const discovery = servicesDiscoverySlot(blocks);
  const proof = servicesProofSlot(blocks);
  const faq = servicesFaqSlot(blocks);
  const cta = servicesCtaSlot(blocks);

  return (
    <div className="min-h-screen bg-background">
      <ServicesHero data={hero.data} path={hero.path} annotation={annotation} />
      <WhatYouGet data={whatYouGet.data} path={whatYouGet.path} annotation={annotation} />
      <HowWeDeliver data={howWeDeliver.data} path={howWeDeliver.path} annotation={annotation} />
      <EngagementPricing
        data={pricingIntro.data}
        path={pricingIntro.path}
        annotation={annotation}
      />
      <DiscoveryScopeShip data={discovery.data} path={discovery.path} annotation={annotation} />
      <ServicesProof data={proof.data} path={proof.path} annotation={annotation} />
      <ServicesFaq data={faq.data} path={faq.path} annotation={annotation} />
      <ClosingCta data={cta.data} path={cta.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
