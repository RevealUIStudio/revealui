// Page 2 of the operator lane — process description that removes the fear
// by making the engagement concrete and bounded.
// Spec: internal non-technical-lane spec (2026-05-14) §3.3 Page 2.
// Phase 4 of the spec's §8 sequence.

import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators-how-it-works/ClosingCta';
import { EngagementSteps } from '../components/for-operators-how-it-works/EngagementSteps';
import { FearRemoval } from '../components/for-operators-how-it-works/FearRemoval';
import { Hero } from '../components/for-operators-how-it-works/Hero';
import { Ownership } from '../components/for-operators-how-it-works/Ownership';
import { Timeline } from '../components/for-operators-how-it-works/Timeline';

export function ForOperatorsHowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <EngagementSteps />
      <FearRemoval />
      <Ownership />
      <Timeline />
      <ClosingCta />
      <Footer />
    </div>
  );
}
