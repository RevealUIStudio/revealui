// Operator-lane landing page — destination of the homepage fork's "I want
// it built for me" branch per spec-2026-05-14-non-technical-lane.md §4.3.
// Spec at ~/revfleet/.jv/docs/spec-2026-05-14-non-technical-lane.md;
// copy at ~/revfleet/.jv/docs/specs/2026-05-28-for-operators-page-1-copy.md.
//
// Phase 1 ship (this PR): the page itself + route registration.
// Phase 2 (homepage fork) and Phase 3 (nav entry) are separate PRs per
// spec §8 sequence — Phase 1 must land first so the fork has a finished
// destination (audit §4.4 dead-end-page finding).

import { Footer } from '../components/Footer';
import { ClosingCta } from '../components/for-operators/ClosingCta';
import { DiscoveryScopeShip } from '../components/for-operators/DiscoveryScopeShip';
import { EngagementPricing } from '../components/for-operators/EngagementPricing';
import { Faq } from '../components/for-operators/Faq';
import { Hero } from '../components/for-operators/Hero';
import { HowWeDeliver } from '../components/for-operators/HowWeDeliver';
import { Proof } from '../components/for-operators/Proof';
import { WhatYouGet } from '../components/for-operators/WhatYouGet';

export function ForOperatorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <WhatYouGet />
      <HowWeDeliver />
      <EngagementPricing />
      <DiscoveryScopeShip />
      <Proof />
      <Faq />
      <ClosingCta />
      <Footer />
    </div>
  );
}
