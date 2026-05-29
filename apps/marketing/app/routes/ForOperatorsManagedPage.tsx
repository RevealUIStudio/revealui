// Page 3 of the operator lane — the honest managed-roadmap page that names
// the future self-serve "RevealUI Cloud" offering and disavows that it ships
// today. Phase 5 of the non-technical-lane spec.
//
// Spec: ~/revfleet/.jv/docs/spec-2026-05-14-non-technical-lane.md §3.3 Page 3.
// Locked decisions: §9.4 OQ-1 ("RevealUI Cloud"), OQ-2 (ship with the lane).

import { Footer } from '../components/Footer';
import { Hero } from '../components/for-operators-managed/Hero';
import { Prerequisites } from '../components/for-operators-managed/Prerequisites';
import { Status } from '../components/for-operators-managed/Status';
import { Today } from '../components/for-operators-managed/Today';
import { Waitlist } from '../components/for-operators-managed/Waitlist';
import { WouldBe } from '../components/for-operators-managed/WouldBe';

export function ForOperatorsManagedPage() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <Status />
      <WouldBe />
      <Prerequisites />
      <Today />
      <Waitlist />
      <Footer />
    </div>
  );
}
