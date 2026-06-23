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
import { Fork } from '../components/landing/Fork';
import { Hero } from '../components/landing/Hero';
import { LocalAi } from '../components/landing/LocalAi';
import { Objections } from '../components/landing/Objections';
import { Persona } from '../components/landing/Persona';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { Primitives } from '../components/landing/Primitives';
import { Problem } from '../components/landing/Problem';
import { Proof } from '../components/landing/Proof';
import { ThesisBand } from '../components/landing/ThesisBand';
import { WhatsShipped } from '../components/landing/WhatsShipped';
import { selectAudience } from '../lib/audience';
import { useAudienceHead } from '../lib/use-audience-head';

/** Developer-facing landing — `/?for=technical`. */
function TechnicalLanding() {
  return (
    <>
      <Hero />
      <Actors />
      <Fork />
      <Problem />
      <Demo />
      <Objections />
      <Primitives />
      <ThesisBand />
      <WhatsShipped />
      <Persona />
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
 * Non-technical (operator) landing — the default `/`. Composes the existing
 * `for-operators/*` section components inline. The shared <Hero/> self-selects
 * the non-technical hero from the audience param, so it is not duplicated here.
 * (The standalone /for-operators route still renders these too; it is retired
 * and redirected here in PR 3.)
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
