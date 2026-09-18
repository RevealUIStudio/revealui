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
      body: 'Talk to an agent and watch it take a real action in your workspace.',
      href: '/agents',
      linkLabel: 'Open agents',
    };
  }
  return {
    title: 'Create your first page',
    body: 'Put something real on the site. Free does not unlock Pro agents.',
    href: '/pages',
    linkLabel: 'Open pages',
  };
}
