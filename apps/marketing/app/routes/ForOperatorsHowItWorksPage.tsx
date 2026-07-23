// Page 2 of the operator lane — process description that removes the fear
// by making the engagement concrete and bounded.
// Spec: internal non-technical-lane spec (2026-05-14) §3.3 Page 2.
// CMS-wired via useMarketingPageBlocks (VES residual; same pattern as fair-source).

import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators-how-it-works/ClosingCta';
import { EngagementSteps } from '../components/for-operators-how-it-works/EngagementSteps';
import { FearRemoval } from '../components/for-operators-how-it-works/FearRemoval';
import { Hero } from '../components/for-operators-how-it-works/Hero';
import { Ownership } from '../components/for-operators-how-it-works/Ownership';
import { Timeline } from '../components/for-operators-how-it-works/Timeline';
import {
  FO_HIW_FALLBACK_BLOCKS,
  foHiwCtaSlot,
  foHiwFearSlot,
  foHiwHeroSlot,
  foHiwOwnershipSlot,
  foHiwStepsSlot,
  foHiwTimelineSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

export function ForOperatorsHowItWorksPage() {
  const { blocks, annotation } = useMarketingPageBlocks(
    'for-operators-how-it-works',
    FO_HIW_FALLBACK_BLOCKS,
  );
  const hero = foHiwHeroSlot(blocks);
  const steps = foHiwStepsSlot(blocks);
  const fear = foHiwFearSlot(blocks);
  const ownership = foHiwOwnershipSlot(blocks);
  const timeline = foHiwTimelineSlot(blocks);
  const cta = foHiwCtaSlot(blocks);

  return (
    <div className="min-h-screen bg-background">
      <Hero data={hero.data} path={hero.path} annotation={annotation} />
      <EngagementSteps data={steps.data} path={steps.path} annotation={annotation} />
      <FearRemoval data={fear.data} path={fear.path} annotation={annotation} />
      <Ownership data={ownership.data} path={ownership.path} annotation={annotation} />
      <Timeline data={timeline.data} path={timeline.path} annotation={annotation} />
      <ClosingCta data={cta.data} path={cta.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
