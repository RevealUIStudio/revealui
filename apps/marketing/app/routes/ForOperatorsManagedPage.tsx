// Page 3 of the operator lane — the honest managed-roadmap page that names
// the future self-serve "RevealUI Cloud" offering and disavows that it ships
// today. Phase 5 of the non-technical-lane spec.
//
// Spec: internal non-technical-lane spec (2026-05-14) §3.3 Page 3.
// Locked decisions: §9.4 OQ-1 ("RevealUI Cloud"), OQ-2 (ship with the lane).
//
// Narrative sections are CMS-wired via useMarketingPageBlocks (VES residual).
// Waitlist form interactivity + product source tag stay component-local.

import { Footer } from '../components/Footer';
import { Hero } from '../components/for-operators-managed/Hero';
import { Prerequisites } from '../components/for-operators-managed/Prerequisites';
import { Status } from '../components/for-operators-managed/Status';
import { Today } from '../components/for-operators-managed/Today';
import { Waitlist } from '../components/for-operators-managed/Waitlist';
import { WouldBe } from '../components/for-operators-managed/WouldBe';
import {
  FO_MANAGED_FALLBACK_BLOCKS,
  foManagedHeroSlot,
  foManagedPrereqsSlot,
  foManagedStatusSlot,
  foManagedTodaySlot,
  foManagedWaitlistSlot,
  foManagedWouldBeSlot,
} from '../lib/page-blocks';
import { useMarketingPageBlocks } from '../lib/use-page-blocks';

export function ForOperatorsManagedPage() {
  const { blocks, annotation } = useMarketingPageBlocks(
    'for-operators-managed',
    FO_MANAGED_FALLBACK_BLOCKS,
  );
  const hero = foManagedHeroSlot(blocks);
  const status = foManagedStatusSlot(blocks);
  const wouldBe = foManagedWouldBeSlot(blocks);
  const prereqs = foManagedPrereqsSlot(blocks);
  const today = foManagedTodaySlot(blocks);
  const waitlist = foManagedWaitlistSlot(blocks);

  return (
    <div className="min-h-screen bg-background">
      <Hero data={hero.data} path={hero.path} annotation={annotation} />
      <Status data={status.data} path={status.path} annotation={annotation} />
      <WouldBe data={wouldBe.data} path={wouldBe.path} annotation={annotation} />
      <Prerequisites data={prereqs.data} path={prereqs.path} annotation={annotation} />
      <Today data={today.data} path={today.path} annotation={annotation} />
      <Waitlist data={waitlist.data} path={waitlist.path} annotation={annotation} />
      <Footer />
    </div>
  );
}
