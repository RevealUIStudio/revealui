import type { LicenseTierId } from '@revealui/contracts/pricing';
import { entitlesReceiptedAgentAction } from '@/lib/components/BeforeDashboard/onboarding-walk';

export interface WelcomeFirstDayCta {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}

/** First-day CTA on /welcome. Free must not point at Pro agent surfaces. */
export function welcomeFirstDayCta(tier: LicenseTierId): WelcomeFirstDayCta {
  if (entitlesReceiptedAgentAction(tier)) {
    return {
      title: 'Run your first agent',
      body: 'Open your agents workspace and choose a supported action to run.',
      href: '/agents',
      linkLabel: 'Open agents',
    };
  }
  return {
    title: 'Create your first page',
    body: 'Create a page and add the content you want to publish.',
    href: '/pages',
    linkLabel: 'Open pages',
  };
}
