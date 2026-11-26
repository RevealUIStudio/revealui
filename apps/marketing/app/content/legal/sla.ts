// Service level commitments page content. Schema reused from LegalSection for
// layout consistency with Terms, Privacy, Security, and Support.
//
// Support policy comes from the public catalog; the 99% infrastructure target
// and 48-hour maintenance notice retain the existing owner-decided commitment.

import { PAID_SUPPORT_POLICY } from '@revealui/contracts/public-catalog';
import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const SLA_META = {
  title: 'Service Level Commitments',
  lastUpdated: 'October 4, 2026',
  intro:
    'RevealUI Studio is a solo-operated company. This page states our support response targets and infrastructure uptime commitment, who they cover, and how to report an issue.',
  notice: {
    variant: 'info' as const,
    title: 'The short version',
    body: `${PAID_SUPPORT_POLICY.summary}. Our license and download infrastructure targets 99% monthly uptime. Live status is at revealui.com/status.`,
  },
} as const;

export const SLA_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Support response times',
    listItems: [PAID_SUPPORT_POLICY.standardResponse, PAID_SUPPORT_POLICY.criticalResponse],
    paragraphs: [
      `These targets apply to email sent to ${SITE.emails.support}. They are the same for every paid tier today.`,
      PAID_SUPPORT_POLICY.applicability,
    ],
  },
  {
    heading: '2. Infrastructure uptime',
    paragraphs: [
      'For the license validation endpoint and the download and release endpoint, we target 99% uptime, measured monthly. That allows about 7.3 hours of downtime in an average month.',
      'If you self-host RevealUI, this uptime commitment covers our infrastructure (license validation, downloads, and updates), not your infrastructure. Your deployment runs on servers you control, and its uptime is your responsibility.',
      'A hosted RevealUI product beyond license and download infrastructure does not yet carry a published uptime commitment. When that changes, this page will say so.',
    ],
  },
  {
    heading: '3. Planned maintenance',
    paragraphs: [
      'When we need to take infrastructure down for planned maintenance, we give at least 48 hours of advance notice by email to affected customers and on our status page.',
    ],
  },
  {
    heading: '4. What happens if our license service is down',
    paragraphs: [
      'If license validation or a hosted service fails, contact support with the error and affected deployment. Availability depends on the configured deployment and service providers. Our Terms explain subscription cancellation and continued use of acquired perpetual versions.',
    ],
  },
  {
    heading: '5. Support coverage',
    paragraphs: [PAID_SUPPORT_POLICY.coverage],
  },
  {
    heading: '6. Status and live updates',
    paragraphs: [
      'Real-time status for revealui.com, admin.revealui.com, api.revealui.com, and docs.revealui.com is published at https://revealui.com/status.',
    ],
  },
  {
    heading: '7. Contact',
    paragraphs: [
      `Questions about these commitments, or about a specific incident, go to ${SITE.emails.support}.`,
    ],
    contactEmail: SITE.emails.support,
  },
];
