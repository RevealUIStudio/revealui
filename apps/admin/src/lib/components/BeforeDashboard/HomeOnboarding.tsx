'use client';

/**
 * Onboarding lead for the CMS Overview home (GAP-300).
 *
 * BeforeDashboard used to own checklist + nudge, but home routes render
 * AdminDashboard Overview — that slot was never mounted. This thin stack is
 * passed as AdminDashboard `overviewLead` so first-session surfaces land on
 * the page founders actually open (/).
 */

import OnboardingChecklist from './OnboardingChecklist';
import OnboardingNudge from './OnboardingNudge';

export default function HomeOnboarding() {
  return (
    <div className="flex flex-col gap-4">
      <OnboardingNudge />
      <OnboardingChecklist />
    </div>
  );
}
