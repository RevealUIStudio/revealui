// Service level commitments page content. Schema reused from LegalSection for
// layout consistency with Terms, Privacy, Security, and Support.
//
// Every number on this page is sourced verbatim from the owner-decided ADR at
// .jv:docs/decisions/sla-target.md (Option B, confirmed 2026-04-16). Do not
// change these numbers here without first changing the ADR; this file is the
// public restatement of that decision, not an independent source.

import { SITE } from '../site';
import type { LegalSection } from './privacy';

export const SLA_META = {
  title: 'Service Level Commitments',
  lastUpdated: 'July 12, 2026',
  intro:
    'RevealUI Studio is a solo-operated company. We would rather commit to numbers we can hit on our worst week than promise something impressive and miss it. This page states exactly what we commit to today, for whom, and what those commitments do not cover.',
  notice: {
    variant: 'info' as const,
    title: 'The short version',
    body: 'We respond within 24 hours during U.S. business hours, and within 4 hours for anything critical. Our license and download infrastructure targets 99% monthly uptime. Live status is always at revealui.com/status.',
  },
} as const;

export const SLA_SECTIONS: readonly LegalSection[] = [
  {
    heading: '1. Support response times',
    listItems: [
      'Business hours: we respond within 24 hours, Monday through Friday, 9am to 5pm U.S. Central Time. This excludes weekends and U.S. federal holidays.',
      'Critical issues: we respond within 4 hours, any day of the week. A critical issue is one where your data is at risk or you are completely unable to use the product you purchased.',
    ],
    paragraphs: [
      `These targets apply to email sent to ${SITE.emails.support}. They are the same for every paid tier today. We often beat them, and we would rather you notice us beating a promise than missing one.`,
    ],
  },
  {
    heading: '2. Infrastructure uptime',
    paragraphs: [
      'For the license validation endpoint and the download and release endpoint, we target 99% uptime, measured monthly. That works out to as much as 7.3 hours of downtime in a month before we would consider ourselves out of this commitment. It is a generous floor on purpose: a solo operator needs room for a bad week without breaking a promise, and our actual uptime is typically well above this floor.',
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
      'If a self-hosted installation cannot reach our license validation service, your previously validated license keeps working for 7 days while we fix the outage. Full detail on every license grace period lives in our Terms of Service.',
    ],
  },
  {
    heading: '5. Why these numbers and not bigger ones',
    paragraphs: [
      'We are one person. There is no on-call rotation and no second engineer to page. A 24-hour response and a 99% uptime floor are numbers we can hold even through a sick week or a vacation. As the team grows, these commitments tighten, not the other way around. Being the solo-operated version of a promise you can trust is worth more to us than the impressive-sounding version we might quietly miss.',
    ],
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
