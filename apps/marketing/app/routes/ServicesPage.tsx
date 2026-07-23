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
  servicesHeroSlot,
  servicesHowWeDeliverSlot,
  servicesPricingIntroSlot,
  servicesProofSlot,
  servicesWhatYouGetSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

/**
 * Done-for-you services landing: `/services`. Narrative sections are CMS-wired
 * via useMarketingPageBlocks (VES residual, same pattern as fair-source).
 * Engagement ladder rungs and FAQ stay static (answers interpolate price
 * anchors from contracts). `?for=non-technical` on `/` is a static alias.
 */
export function ServicesPage() {
  const { blocks, annotation } = useMarketingPageBlocks('services', SERVICES_FALLBACK_BLOCKS);
  const hero = servicesHeroSlot(blocks);
  const whatYouGet = servicesWhatYouGetSlot(blocks);
  const howWeDeliver = servicesHowWeDeliverSlot(blocks);
  const pricingIntro = servicesPricingIntroSlot(blocks);
  const discovery = servicesDiscoverySlot(blocks);
  const proof = servicesProofSlot(blocks);
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
      <ServicesFaq />
      <ClosingCta data={cta.data} path={cta.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
