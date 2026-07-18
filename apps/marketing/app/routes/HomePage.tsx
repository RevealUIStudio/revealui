import type { BlockAnnotation } from '@revealui/presentation';
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
import { Demo } from '../components/landing/Demo';
import { Hero } from '../components/landing/Hero';
import { PricingTeaser } from '../components/landing/PricingTeaser';
import { Primitives } from '../components/landing/Primitives';
import { Problem } from '../components/landing/Problem';
import { Proof } from '../components/landing/Proof';
import { selectAudience } from '../lib/audience';
import {
  type BlockSlot,
  type DemoData,
  demoSlot,
  type GetStartedData,
  getStartedSlot,
  HOME_FALLBACK_BLOCKS,
  type PrimitivesData,
  primitivesSlot,
} from '../lib/page-blocks';
import { useAudienceHead } from '../lib/use-audience-head';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

// Annotation is inactive in this slice; the editor-canvas slice activates it.
const INACTIVE_ANNOTATION: BlockAnnotation = { editable: false };

/**
 * Developer-facing landing: `/?for=technical`, and the default `/` since the
 * 2026-07-09 funnel declutter. 17 sections trimmed to 11, then 11 to 7 in
 * frontend-excellence Phase 1 (ADR 2026-07-10-frontend-design-direction hard
 * rule: marketing homepage <= 7 sections). Cut in this pass: Actors (thin
 * vocab explainer, superseded by the audience toggle + Primitives' Agents
 * row), ThesisBand (a single pull-quote restating the hero/Problem
 * positioning), LocalAi (its strongest beat already lives in Proof's
 * PROOF_LOCAL_AI card; the interactive provider-switch + snippet live on the
 * dedicated /local-ai page), and Faq (5 of 7 answers duplicated Proof's
 * CI-signals/license-split/portability/dogfooding content; the remaining two
 * are single-fact pointers already covered by Primitives' Agents row and the
 * pricing page's agents section). The hero's CLI block moved to GetStarted;
 * its two inline text CTAs (services, agency licensing) moved to the footer.
 */
interface TechnicalLandingProps {
  demo: BlockSlot<DemoData>;
  primitives: BlockSlot<PrimitivesData>;
  getStarted: BlockSlot<GetStartedData>;
  annotation: BlockAnnotation;
}

function TechnicalLanding({ demo, primitives, getStarted, annotation }: TechnicalLandingProps) {
  return (
    <>
      <Hero />
      <Problem />
      <Demo data={demo.data} path={demo.path} annotation={annotation} />
      <Primitives data={primitives.data} path={primitives.path} annotation={annotation} />
      <Proof />
      <PricingTeaser />
      <GetStarted data={getStarted.data} path={getStarted.path} annotation={annotation} />
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
  const blocks = useMarketingPageBlocks('home', HOME_FALLBACK_BLOCKS);
  const demo = demoSlot(blocks);
  const primitives = primitivesSlot(blocks);
  const getStarted = getStartedSlot(blocks);
  return (
    <div className="min-h-screen bg-background">
      {audience === 'non-technical' ? (
        <NonTechnicalLanding />
      ) : (
        <TechnicalLanding
          demo={demo}
          primitives={primitives}
          getStarted={getStarted}
          annotation={INACTIVE_ANNOTATION}
        />
      )}
    </div>
  );
}
