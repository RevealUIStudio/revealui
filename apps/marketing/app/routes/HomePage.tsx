import { useLocation } from '@revealui/router';
import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators/ClosingCta';
import { DiscoveryScopeShip } from '../components/for-operators/DiscoveryScopeShip';
import { EngagementPricing } from '../components/for-operators/EngagementPricing';
import { Faq as OperatorFaq } from '../components/for-operators/Faq';
import { HowWeDeliver } from '../components/for-operators/HowWeDeliver';
import { Proof as OperatorProof } from '../components/for-operators/Proof';
import { WhatYouGet } from '../components/for-operators/WhatYouGet';
import { GetStarted } from '../components/GetStarted';
import { Actors } from '../components/landing/Actors';
import { Demo } from '../components/landing/Demo';
import { Faq } from '../components/landing/Faq';
import { Hero } from '../components/landing/Hero';
import { LocalAi } from '../components/landing/LocalAi';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { Primitives } from '../components/landing/Primitives';
import { Problem } from '../components/landing/Problem';
import { Proof } from '../components/landing/Proof';
import { ThesisBand } from '../components/landing/ThesisBand';
import { selectAudience } from '../lib/audience';
import { useAudienceHead } from '../lib/use-audience-head';

/**
 * Developer-facing landing: `/?for=technical`, and the default `/` since the
 * 2026-07-09 funnel declutter (internal marketing funnel audit). 17 sections
 * trimmed to ~11. The Fork, the "What ships today" grid, the Objections
 * section, the standalone Persona section, and the WhatsShipped capabilities
 * grid were removed or merged elsewhere (Proof, FAQ); the cost calculator
 * moved to /pricing.
 */
function TechnicalLanding() {
  return (
    <>
      <Hero />
      <Actors />
      <Problem />
      <Demo />
      <Primitives />
      <ThesisBand />
      <LocalAi />
      <Proof />
      <PricingTeaser />
      <Faq />
      <GetStarted />
      <Footer />
    </>
  );
}

/**
 * Non-technical (operator) landing: `?for=non-technical`. Composes the
 * existing `for-operators/*` section components inline. The shared <Hero/>
 * self-selects the non-technical hero from the audience param, so it is not
 * duplicated here. The same content also lives at its own URL, `/services`
 * (ServicesPage.tsx), using the standalone for-operators Hero component; this
 * audience-param route is kept as an alias.
 */
function NonTechnicalLanding() {
  return (
    <>
      <Hero />
      <WhatYouGet />
      <HowWeDeliver />
      <EngagementPricing />
      <DiscoveryScopeShip />
      <OperatorProof />
      <OperatorFaq />
      <ClosingCta />
      <Footer />
    </>
  );
}

export function HomePage() {
  const { search } = useLocation();
  const audience = selectAudience(search);
  useAudienceHead(audience);
  return (
    <div className="min-h-screen bg-background">
      {audience === 'non-technical' ? <NonTechnicalLanding /> : <TechnicalLanding />}
    </div>
  );
}
